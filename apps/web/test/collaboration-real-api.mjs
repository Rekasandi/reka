// Authenticated multi-user browser → Nest HTTP → isolated PostgreSQL collaboration acceptance test.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../../api/test/support/isolated-api.cjs', import.meta.url));
const { createPersistentPostgres } = require('./persistent-postgres.cjs');
const { createIsolatedApi } = require('./isolated-api.cjs');
const { organizations, organizationMembers, users, teams, teamMembers, teamWorkflowStates, sessions, issues, comments, notifications, issueSubscriptions, notificationPreferences, attachments, githubInstallations, githubRepositories, githubBranches, githubPullRequests, webhookEvents } = require('@reka/database');
const { eq } = require('drizzle-orm');
const modules = ['activities', 'attachments', 'comments', 'cycles', 'github', 'issues', 'issue-subscriptions', 'labels', 'notifications', 'projects', 'teams', 'users', 'views', 'workspace'].map(name => Object.values(require(`../../dist/${name}/${name}.module`))[0]);
modules.push(Object.values(require('../../dist/common/redis/redis.module'))[0]);
const { RedisService } = require('../../dist/common/redis/redis.service');
const ui = fileURLToPath(new URL('../../../packages/ui/src/index.ts', import.meta.url));
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { chromium } = playwright.chromium ? playwright : playwright.default;
const postgres = await createPersistentPostgres();
let api, browser;
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
try {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
  const [org] = await postgres.db.insert(organizations).values({ name: 'Collaboration browser', slug: `collab-browser-${suffix}` }).returning();
  const [owner, member, privateOutsider] = await postgres.db.insert(users).values([
    { name: 'Collaboration Owner', email: `collab-owner-${suffix}@example.test`, role: 'owner', githubUsername: 'collab-owner' },
    { name: 'Pat Person', email: `pat-${suffix}@example.test`, role: 'member', githubUsername: 'pat-dev' },
    { name: 'Private Outsider', email: `private-${suffix}@example.test`, role: 'member', githubUsername: 'private-outsider' },
  ]).returning();
  await postgres.db.insert(organizationMembers).values([
    { organizationId: org.id, userId: owner.id, role: 'owner' }, { organizationId: org.id, userId: member.id, role: 'member' }, { organizationId: org.id, userId: privateOutsider.id, role: 'member' },
  ]);
  const [team, privateTeam] = await postgres.db.insert(teams).values([
    { organizationId: org.id, name: 'Shared work', key: `SHR${suffix.slice(0, 4)}` },
    { organizationId: org.id, name: 'Private work', key: `PRV${suffix.slice(0, 4)}`, isPrivate: true },
  ]).returning();
  await postgres.db.insert(teamMembers).values([
    { teamId: team.id, userId: owner.id, role: 'lead' }, { teamId: team.id, userId: member.id, role: 'member' }, { teamId: privateTeam.id, userId: owner.id, role: 'lead' },
  ]);
  await postgres.db.insert(teamWorkflowStates).values([
    { teamId: team.id, key: 'todo', name: 'Todo', category: 'unstarted', color: '#777777', position: 0 },
    { teamId: team.id, key: 'doing', name: 'In Progress', category: 'started', color: '#777777', position: 1 },
    { teamId: team.id, key: 'done', name: 'Done', category: 'completed', color: '#777777', position: 2 },
    { teamId: team.id, key: 'triage', name: 'Triage', category: 'triage', color: '#777777', position: 3 },
    { teamId: team.id, key: 'canceled', name: 'Canceled', category: 'canceled', color: '#777777', position: 4 },
    { teamId: team.id, key: 'backlog', name: 'Backlog', category: 'backlog', color: '#777777', position: 5 },
    { teamId: privateTeam.id, key: 'todo', name: 'Todo', category: 'unstarted', color: '#777777', position: 0 },
  ]);
  const [issue] = await postgres.db.insert(issues).values({ identifier: `${team.key}-1`, number: 1, title: 'Shared review thread', teamId: team.id, reporterId: owner.id, assigneeId: member.id, status: 'todo', description: 'A comment and file should be visible to authorized teammates.' }).returning();
  const [githubInstallation] = await postgres.db.insert(githubInstallations).values({ organizationId: org.id, installationId: Date.now() + 501, accountLogin: 'acme' }).returning();
  const [githubRepository] = await postgres.db.insert(githubRepositories).values({ installationId: githubInstallation.id, repoId: Date.now() + 502, owner: 'acme', name: 'project', fullName: 'acme/project' }).returning();
  await postgres.db.insert(githubBranches).values({ repositoryId: githubRepository.id, issueId: issue.id, name: `feature/${issue.identifier}-browser`, sha: 'c'.repeat(40) });
  await postgres.db.insert(githubPullRequests).values({ repositoryId: githubRepository.id, issueId: issue.id, prNumber: 23, title: 'Browser-verified PR', state: 'open', merged: false, branchName: `feature/${issue.identifier}-browser`, htmlUrl: 'https://github.com/acme/project/pull/23', reviewStatus: 'approved' });
  await postgres.db.insert(webhookEvents).values({ deliveryId: `failed-${suffix}`, event: 'pull_request', payload: { installation: { id: githubInstallation.installationId } }, processed: false, error: 'Transient test failure for delivery status display' });
  await postgres.db.insert(issues).values({ identifier: `${privateTeam.key}-1`, number: 1, title: 'Private team only', teamId: privateTeam.id, reporterId: owner.id, status: 'todo' });
  const tokens = new Map();
  for (const user of [owner, member, privateOutsider]) {
    const token = randomUUID(); tokens.set(user.id, token);
    await postgres.db.insert(sessions).values({ id: token, userId: user.id, expiresAt: new Date(Date.now() + 86400000) });
  }
  api = await createIsolatedApi(postgres, modules, [[RedisService, { getClient: () => { throw new Error('Redis intentionally unavailable in the isolated collaboration browser test'); } }]]);
  browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const errors = []; const apiFailures = []; const seenApi = [];
  const createPage = async user => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => { errors.push(error.message); console.error('browser error:', error.message); });
    page.on('console', message => { if (message.type() === 'error') console.error('browser console:', message.text()); });
    // Report paths only: query strings can contain dev-server or session tokens.
    page.on('requestfailed', request => console.error('browser request failed:', new URL(request.url()).pathname, request.failure()?.errorText));
    page.on('response', response => {
      if (response.status() < 400) return;
      const path = new URL(response.url()).pathname;
      if (path.startsWith('/api/')) { apiFailures.push(`${response.status()} ${path}`); console.error('Collaboration API failure:', response.status(), path); }
      else console.error('Vite asset failure:', response.status(), path);
    });
    await page.route('**/api/**', async route => {
      const request = route.request(); const path = new URL(request.url()).pathname;
      if (!path.startsWith('/api/')) return route.continue();
      seenApi.push(`${request.method()} ${path}`);
      return route.continue({ url: `${api.url}${path}${new URL(request.url()).search}`, headers: { ...request.headers(), authorization: `Bearer ${tokens.get(user.id)}` } });
    });
    await page.route('**/src/app/main.tsx*', async route => {
      const original = await (await route.fetch()).text();
      const version = original.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
      await route.fulfill({ contentType: 'application/javascript', body: `
        import React from '/node_modules/.vite/deps/react.js${version}';
        import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${version}';
        import { QueryClient, QueryClientProvider } from '/node_modules/.vite/deps/@tanstack_react-query.js${version}';
        import { MemoryRouter, Routes, Route } from '/node_modules/.vite/deps/react-router-dom.js${version}';
        import { TooltipProvider } from '/@fs${ui}';
        import { ThemeProvider } from '/src/components/theme/theme-provider.tsx';
        import { IssueDetailSheet } from '/src/features/issues/components/issue-detail-sheet.tsx';
        import { IssueDetailPage } from '/src/features/issues/components/issue-detail-page.tsx';
        import { InboxPage } from '/src/features/notifications/components/inbox-page.tsx';
        import { SettingsPage } from '/src/features/settings/components/settings-page.tsx';
        import { useAuthStore } from '/src/stores/auth.store.ts';
        import '/src/styles/globals.css';
        const issue = ${JSON.stringify(issue)};
        useAuthStore.setState({ user: ${JSON.stringify(user)}, isAuthenticated: true });
        function IssueRoute() { return React.createElement(IssueDetailSheet, { issue, open: true, onOpenChange: () => {} }); }
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(TooltipProvider, null,
          React.createElement(ThemeProvider, { defaultTheme: new URLSearchParams(location.search).get('theme') || 'light', storageKey: 'collaboration-e2e' },
            React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
              React.createElement(MemoryRouter, { initialEntries: [new URLSearchParams(location.search).get('page') === 'inbox' ? '/inbox' : new URLSearchParams(location.search).get('page') === 'github-settings' ? '/settings' : '/issue'] },
                React.createElement(Routes, null,
                  React.createElement(Route, { path: '/issue', element: React.createElement(IssueRoute) }),
                  React.createElement(Route, { path: '/issues/:id', element: React.createElement(IssueDetailPage) }),
                  React.createElement(Route, { path: '/inbox', element: React.createElement(InboxPage) }),
                  React.createElement(Route, { path: '/settings', element: React.createElement(SettingsPage) })))))));
      ` });
    });
    return page;
  };
  const url = process.env.WEB_URL || 'http://localhost:5173';
  const ownerIssuePage = await createPage(owner); await ownerIssuePage.goto(`${url}?page=issue`);
  try { await ownerIssuePage.getByRole('heading', { name: `Issue ${issue.identifier}` }).waitFor({ timeout: 12000 }); }
  catch (error) { console.error('Issue page body:', (await ownerIssuePage.locator('body').innerText()).slice(0, 1500)); console.error('Issue page errors:', errors, 'API failures:', apiFailures); throw error; }
  await ownerIssuePage.getByRole('textbox', { name: 'Write a comment' }).waitFor();
  await ownerIssuePage.getByRole('button', { name: /GitHub \(/ }).click();
  await ownerIssuePage.getByText('GitHub Pull Requests & CI', { exact: true }).waitFor();
  await ownerIssuePage.getByText('Browser-verified PR', { exact: true }).waitFor();
  await ownerIssuePage.getByText(`branch: feature/${issue.identifier}-browser`, { exact: true }).waitFor();
  await ownerIssuePage.getByText('CI status not reported', { exact: true }).waitFor();
  await ownerIssuePage.getByText('Approved', { exact: true }).waitFor();
  await ownerIssuePage.getByRole('link', { name: new RegExp(`feature/${issue.identifier}-browser`) }).waitFor();
  assert.ok(seenApi.some(entry => entry === `GET /api/integrations/github/pull-requests/by-issue/${issue.id}`));
  assert.ok(seenApi.some(entry => entry === `GET /api/integrations/github/pull-requests/branches/by-issue/${issue.id}`));
  const originalFetch = globalThis.fetch; const previousGithubToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'controlled-browser-contract-token';
  globalThis.fetch = async (input, init) => {
    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (requestUrl === `https://api.github.com/repos/acme/project/pulls/24`) return Response.json({
      number: 24, title: 'Browser linked verified PR', state: 'open', merged: false,
      html_url: 'https://github.com/acme/project/pull/24', head: { ref: `feature/${issue.identifier}-manual` },
      base: { repo: { id: githubRepository.repoId } },
    });
    return originalFetch(input, init);
  };
  try {
    await ownerIssuePage.getByRole('button', { name: 'Link PR' }).click();
    const linkDialog = ownerIssuePage.getByRole('dialog', { name: 'Link GitHub Pull Request' });
    await linkDialog.getByPlaceholder('e.g. 42').fill('24');
    const linkResponse = ownerIssuePage.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/integrations/github/pull-requests/link');
    await linkDialog.getByRole('button', { name: 'Verify and link' }).click();
    assert.equal((await linkResponse).status(), 201);
    await linkDialog.waitFor({ state: 'hidden' });
    await ownerIssuePage.getByText('Browser linked verified PR', { exact: true }).waitFor();
    assert.equal((await postgres.db.select().from(githubPullRequests).where(eq(githubPullRequests.prNumber, 24))).length, 1);
    assert.equal((await postgres.db.select().from(issues).where(eq(issues.id, issue.id)))[0].status, 'doing', 'verified PR link maps to the team’s configured active workflow state');
  } finally {
    globalThis.fetch = originalFetch;
    if (previousGithubToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previousGithubToken;
  }
  const memberIssuePage = await createPage(member); await memberIssuePage.goto(`${url}?page=issue`);
  await memberIssuePage.getByRole('heading', { name: `Issue ${issue.identifier}` }).waitFor();
  const followedResponse = memberIssuePage.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/issues/${issue.id}/subscription`);
  await memberIssuePage.getByRole('button', { name: 'Follow issue' }).click();
  assert.equal((await followedResponse).status(), 201);
  assert.equal((await postgres.db.select().from(issueSubscriptions).where(eq(issueSubscriptions.issueId, issue.id))).length, 1, 'follow action is persisted per-user');

  const memberInboxPage = await createPage(member); await memberInboxPage.goto(`${url}?page=inbox`);
  await memberInboxPage.getByRole('heading', { name: 'Inbox', exact: true }).waitFor();
  const commentBox = ownerIssuePage.getByRole('textbox', { name: 'Write a comment' });
  await commentBox.fill('Please review @pat');
  const mention = ownerIssuePage.getByRole('option', { name: /Pat Person.*@pat-dev/ });
  await mention.waitFor(); await mention.click();
  assert.equal(await commentBox.inputValue(), 'Please review @pat-dev ');
  const mentionResponse = ownerIssuePage.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/comments/by-issue/${issue.id}`);
  await ownerIssuePage.getByRole('button', { name: 'Comment', exact: true }).click();
  assert.equal((await mentionResponse).status(), 201);
  await memberIssuePage.getByText('Please review @pat-dev', { exact: true }).waitFor({ timeout: 12000 });
  const mentionRows = await postgres.db.select().from(notifications).where(eq(notifications.userId, member.id));
  assert.equal(mentionRows.filter(row => row.type === 'mention').length, 1);
  await memberInboxPage.getByText('Mention', { exact: true }).first().waitFor({ timeout: 25000 });
  await memberInboxPage.getByRole('button', { name: 'Mark all notifications as read' }).click();
  await memberInboxPage.waitForTimeout(250);
  assert.ok((await postgres.db.select().from(notifications).where(eq(notifications.userId, member.id))).every(row => row.read), 'Inbox mark-all-read persists in the database');

  await memberInboxPage.getByRole('button', { name: 'Notification preferences' }).click();
  const preferences = memberInboxPage.getByRole('dialog', { name: 'Notification preferences' });
  await preferences.waitFor(); await preferences.getByRole('checkbox', { name: 'Comments' }).uncheck();
  const preferenceResponse = memberInboxPage.waitForResponse(response => response.request().method() === 'PUT' && new URL(response.url()).pathname === '/api/notifications/preferences');
  await preferences.getByRole('button', { name: 'Save preferences' }).click();
  assert.equal((await preferenceResponse).status(), 200);
  assert.equal((await postgres.db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, member.id)))[0].preferences.comments, false);

  const beforeCommentNotifications = (await postgres.db.select().from(notifications).where(eq(notifications.userId, member.id))).length;
  await ownerIssuePage.getByRole('textbox', { name: 'Write a comment' }).fill('A team note after preferences are changed');
  const subscriberCommentResponse = ownerIssuePage.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/comments/by-issue/${issue.id}`);
  await ownerIssuePage.getByRole('button', { name: 'Comment', exact: true }).click();
  assert.equal((await subscriberCommentResponse).status(), 201);
  await memberIssuePage.getByText('A team note after preferences are changed', { exact: true }).waitFor({ timeout: 12000 });
  assert.equal((await postgres.db.select().from(notifications).where(eq(notifications.userId, member.id))).length, beforeCommentNotifications, 'notification preference suppresses new subscriber comment notices');

  await ownerIssuePage.getByRole('button', { name: /Attachments \(/ }).click();
  await memberIssuePage.getByRole('button', { name: /Attachments \(/ }).click();
  const fileInput = ownerIssuePage.getByLabel('Choose issue attachment');
  const uploadResponse = ownerIssuePage.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/attachments/by-issue/${issue.id}`);
  await fileInput.setInputFiles({ name: 'shared-note.png', mimeType: 'image/png', buffer: png });
  assert.equal((await uploadResponse).status(), 201);
  await memberIssuePage.getByRole('link', { name: 'Download shared-note.png' }).waitFor({ timeout: 12000 });
  const storedAttachment = (await postgres.db.select().from(attachments).where(eq(attachments.issueId, issue.id)))[0];
  assert.ok(storedAttachment.content); assert.equal(Buffer.compare(Buffer.from(storedAttachment.content), png), 0);

  const editor = ownerIssuePage.getByRole('button', { name: 'Edit comment by Collaboration Owner' }).first();
  await editor.click();
  const editBox = ownerIssuePage.getByRole('textbox', { name: 'Edit comment' }).first();
  await editBox.fill('Edited mention is persisted');
  const updateResponse = ownerIssuePage.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname.startsWith('/api/comments/'));
  await ownerIssuePage.getByRole('button', { name: 'Save', exact: true }).click();
  assert.equal((await updateResponse).status(), 200);
  assert.equal((await postgres.db.select().from(comments).where(eq(comments.issueId, issue.id))).some(row => row.body === 'Edited mention is persisted'), true);
  await ownerIssuePage.getByRole('tab', { name: /Activity/ }).click();
  await ownerIssuePage.getByText(/comment_updated/).waitFor({ timeout: 12000 });
  await ownerIssuePage.getByRole('tab', { name: /Comments/ }).click();

  const ownerSettingsPage = await createPage(owner);
  await ownerSettingsPage.goto(`${url}?page=github-settings`);
  try { await ownerSettingsPage.getByText('Recent GitHub webhook deliveries', { exact: true }).waitFor({ timeout: 12000 }); }
  catch (error) { console.error('Settings page body:', (await ownerSettingsPage.locator('body').innerText()).slice(0, 1800)); console.error('Settings errors:', errors, 'API failures:', apiFailures); throw error; }
  await ownerSettingsPage.getByText('Transient test failure for delivery status display', { exact: true }).waitFor();
  await ownerSettingsPage.getByText('Failed', { exact: true }).waitFor();
  assert.ok(seenApi.some(entry => entry === 'GET /api/integrations/github/installations/webhook-deliveries'));

  assert.ok(seenApi.some(entry => entry === `POST /api/issues/${issue.id}/subscription`));
  assert.ok(seenApi.some(entry => entry === `POST /api/comments/by-issue/${issue.id}`));
  assert.ok(seenApi.some(entry => entry === 'PUT /api/notifications/preferences'));
  assert.ok(seenApi.some(entry => entry === `POST /api/attachments/by-issue/${issue.id}`));
  assert.equal(apiFailures.length, 0, `unexpected API failures: ${apiFailures.join(', ')}`);
  assert.deepEqual(errors, []);

  for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
    await ownerIssuePage.setViewportSize({ width, height: 900 });
    await ownerIssuePage.goto(`${url}?page=issue&theme=${theme}`);
    await ownerIssuePage.locator('[data-issue-detail]').waitFor();
    await ownerIssuePage.waitForTimeout(150);
    assert.equal(await ownerIssuePage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `issue ${theme} ${width}px has no horizontal overflow`);
    await ownerIssuePage.screenshot({ path: `/tmp/reka-collaboration-issue-${theme}-${width}.png` });

    await memberInboxPage.setViewportSize({ width, height: 900 });
    await memberInboxPage.goto(`${url}?page=inbox&theme=${theme}`);
    await memberInboxPage.getByRole('heading', { name: 'Inbox', exact: true }).waitFor();
    await memberInboxPage.waitForTimeout(150);
    assert.equal(await memberInboxPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `inbox ${theme} ${width}px has no horizontal overflow`);
    await memberInboxPage.screenshot({ path: `/tmp/reka-collaboration-inbox-${theme}-${width}.png` });

    await ownerSettingsPage.setViewportSize({ width, height: 900 });
    await ownerSettingsPage.goto(`${url}?page=github-settings&theme=${theme}`);
    await ownerSettingsPage.getByText('Recent GitHub webhook deliveries', { exact: true }).waitFor();
    await ownerSettingsPage.waitForTimeout(150);
    assert.equal(await ownerSettingsPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `GitHub settings ${theme} ${width}px has no horizontal overflow`);
    await ownerSettingsPage.screenshot({ path: `/tmp/reka-github-settings-${theme}-${width}.png` });
  }
  console.log('PASS: authenticated owner/member browser sessions exercise collaboration plus persisted GitHub PR/branch reads and workspace-scoped webhook failure visibility through Nest and isolated Postgres. Issue/inbox desktop+mobile light/dark captures show no horizontal overflow. Live GitHub OAuth/webhook delivery and deployment remain unverified.');
} finally { if (browser) await browser.close(); if (api) await api.close(); await postgres.close(); }
