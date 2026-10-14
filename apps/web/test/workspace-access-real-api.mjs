// Focused real Users/Workspace/Login surfaces -> actual Nest -> isolated Postgres.
// GitHub authorization/profile responses are contract fixtures, never live proof.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../../api/test/support/isolated-api.cjs', import.meta.url));
const { createPersistentPostgres } = require('./persistent-postgres.cjs');
const { createIsolatedApi } = require('./isolated-api.cjs');
const { users, organizations, organizationMembers, sessions, workspaceInvitations } = require('@reka/database');
const { eq } = require('drizzle-orm');
const modules = ['users', 'workspace', 'auth', 'teams', 'issues', 'projects', 'cycles'].map(name => Object.values(require(`../../dist/${name}/${name}.module`))[0]);
const ui = fileURLToPath(new URL('../../../packages/ui/src/index.ts', import.meta.url));
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { chromium } = playwright.chromium ? playwright : playwright.default;
const url = process.env.WEB_URL || 'http://localhost:5173';
const savedFetch = global.fetch;
const savedEnv = { GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET, WEB_URL: process.env.WEB_URL };
process.env.GITHUB_CLIENT_ID = 'isolated-browser-client';
process.env.GITHUB_CLIENT_SECRET = 'isolated-browser-secret';
process.env.WEB_URL = url;
const postgres = await createPersistentPostgres();
let api, browser;
try {
  const [org] = await postgres.db.insert(organizations).values({ name: 'Browser company', slug: 'browser-company' }).returning();
  const people = {}, tokens = {};
  for (const [name, role] of [['Owner', 'owner'], ['Admin', 'admin'], ['Member', 'member']]) {
    const [user] = await postgres.db.insert(users).values({ name, email: `${name.toLowerCase()}@example.test`, role }).returning();
    people[name] = user;
    await postgres.db.insert(organizationMembers).values({ organizationId: org.id, userId: user.id, role });
    tokens[name] = randomUUID();
    await postgres.db.insert(sessions).values({ id: tokens[name], userId: user.id, expiresAt: new Date(Date.now() + 86400000) });
  }
  api = await createIsolatedApi(postgres, modules);
  global.fetch = async (input, options = {}) => {
    const target = String(input);
    if (target === 'https://github.com/login/oauth/access_token') return Response.json({ access_token: 'isolated-browser-provider-token' });
    if (target === 'https://api.github.com/user') return Response.json({ id: 900001, login: 'joined-person', name: 'Joined Person', avatar_url: null });
    if (target === 'https://api.github.com/user/emails') return Response.json([{ email: 'joined@example.test', verified: true, primary: false }]);
    if (target.startsWith('https://api.github.com/') || target.startsWith('https://github.com/')) throw new Error('Unexpected external provider request');
    return savedFetch(input, options);
  };
  browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const errors = [], requests = [], networkFailures = [];
  async function pageFor(who) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    if (who) await context.addCookies([{ name: 'reka_session', value: tokens[who], url, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage();
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
    page.on('requestfailed', request => networkFailures.push(new URL(request.url()).pathname));
    await page.route('**/api/**', async route => {
      const request = route.request(), target = new URL(request.url());
      if (!target.pathname.startsWith('/api/')) return route.continue();
      requests.push(`${request.method()} ${target.pathname}`);
      // Preserve actual response bodies/Set-Cookie headers; no API response mocks.
      const response = await route.fetch({ url: `${api.url}${target.pathname}${target.search}`, headers: await request.allHeaders(), maxRedirects: 0 });
      if (response.status() >= 400 && target.pathname !== '/api/auth/me') console.error('API rejection:', request.method(), target.pathname, response.status());
      if (target.pathname === '/api/auth/github' && response.status() === 302) {
        // Replay only the external authorization handoff. Playwright cannot
        // intercept subsequent URLs in a redirected navigation reliably.
        // Both nonce issuance and callback/session responses remain actual Nest.
        const state = new URL(response.headers().location).searchParams.get('state');
        const cookie = response.headersArray().find(header => header.name.toLowerCase() === 'set-cookie').value.split(';')[0];
        const callback = await context.request.get(`${api.url}/api/auth/github/callback?code=controlled-contract-code&state=${state}`, { headers: { Cookie: cookie }, maxRedirects: 0 });
        return route.fulfill({ response: callback });
      }
      return route.fulfill({ response });
    });
    await context.route('https://github.com/**', route => route.abort());
    await page.route('**/src/app/main.tsx*', async route => {
      const original = await (await route.fetch()).text();
      const version = original.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
      return route.fulfill({ contentType: 'application/javascript', body: `
        import React from '/node_modules/.vite/deps/react.js${version}';
        import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${version}';
        import { QueryClient, QueryClientProvider } from '/node_modules/.vite/deps/@tanstack_react-query.js${version}';
        import { BrowserRouter, Routes, Route } from '/node_modules/.vite/deps/react-router-dom.js${version}';
        import { TooltipProvider, Toaster } from '/@fs${ui}';
        import { ThemeProvider } from '/src/components/theme/theme-provider.tsx';
        import { UsersPage } from '/src/features/users/components/users-page.tsx';
        import { WorkspaceSettings } from '/src/features/settings/components/workspace-settings.tsx';
        import { LoginPage } from '/src/features/auth/components/login-page.tsx';
        import { TeamsPage } from '/src/features/teams/components/teams-page.tsx';
        import { TeamDetailPage } from '/src/features/teams/components/team-detail-page.tsx';
        import { useAuthStore } from '/src/stores/auth.store.ts';
        import '/src/styles/globals.css';
        await useAuthStore.getState().fetchCurrentUser();
        const surface = React.createElement(Routes, null,
          React.createElement(Route, { path: '/login', element: React.createElement(LoginPage) }),
          React.createElement(Route, { path: '/teams', element: React.createElement(TeamsPage) }),
          React.createElement(Route, { path: '/teams/:id', element: React.createElement(TeamDetailPage) }),
          React.createElement(Route, { path: '*', element: React.createElement('main', { className: 'flex flex-col gap-6 p-6' }, React.createElement(UsersPage), React.createElement(WorkspaceSettings)) }));
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(TooltipProvider, null,
          React.createElement(ThemeProvider, { defaultTheme: new URLSearchParams(location.search).get('theme') || 'dark', storageKey: 'workspace-e2e' },
            React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
              React.createElement(BrowserRouter, null, surface, React.createElement(Toaster))))));
      ` });
    });
    return page;
  }
  const owner = await pageFor('Owner');
  await owner.goto(`${url}/users`);
  await owner.getByLabel('Workspace name').fill('Renamed browser company');
  await owner.getByRole('button', { name: 'Save workspace', exact: true }).click();
  await owner.getByText('Workspace updated', { exact: true }).waitFor();
  await owner.getByRole('button', { name: 'Invite User', exact: true }).first().click();
  let dialog = owner.getByRole('dialog', { name: 'Invite User', exact: true });
  await dialog.getByLabel('Work email', { exact: true }).fill('joined@example.test');
  await dialog.getByRole('button', { name: 'Create invitation link', exact: true }).click();
  const invitationLink = await dialog.getByLabel('Invitation link', { exact: true }).inputValue();
  assert.equal(new URL(invitationLink).pathname, '/login');
  assert.equal((await postgres.db.select().from(workspaceInvitations))[0].email, 'joined@example.test');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await postgres.reopen();
  await owner.reload();
  await owner.getByText('joined@example.test', { exact: true }).waitFor();
  assert.equal(await owner.getByLabel('Workspace name').inputValue(), 'Renamed browser company');
  await owner.getByLabel('Role for Owner').click();
  await owner.getByRole('option', { name: 'Member', exact: true }).click();
  await owner.getByText('Cannot remove, deactivate or demote the last active workspace owner', { exact: true }).waitFor();
  assert.equal((await postgres.db.select().from(organizationMembers).where(eq(organizationMembers.userId, people.Owner.id)))[0].role, 'owner');
  const joined = await pageFor();
  await joined.goto(invitationLink);
  await joined.getByRole('heading', { name: 'Join your workspace' }).waitFor();
  await joined.getByRole('button', { name: 'Continue with GitHub' }).click();
  await joined.waitForURL('**/dashboard?auth=success**');
  await joined.getByText('Joined Person', { exact: true }).waitFor();
  assert.equal(await joined.getByRole('button', { name: 'Invite User', exact: true }).count(), 0);
  assert.equal(await joined.getByLabel('Role for Owner').count(), 0);
  let [member] = await postgres.db.select().from(users).where(eq(users.githubId, '900001'));
  assert(member);
  let [accepted] = await postgres.db.select().from(workspaceInvitations);
  assert(accepted.acceptedAt); assert.equal(accepted.acceptedById, member.id);
  await postgres.reopen();
  await joined.reload();
  await joined.getByText('Joined Person', { exact: true }).waitFor();
  await owner.reload();
  await owner.getByText('Accepted', { exact: true }).waitFor();
  await owner.getByLabel('Role for Joined Person').click();
  await owner.getByRole('option', { name: 'Admin', exact: true }).click();
  await owner.getByText('User "Joined Person" updated', { exact: true }).waitFor();
  assert.equal((await postgres.db.select().from(organizationMembers).where(eq(organizationMembers.userId, member.id)))[0].role, 'admin');
  await joined.reload();
  await joined.getByRole('button', { name: 'Invite User', exact: true }).first().waitFor();
  await owner.getByRole('button', { name: 'Invite User', exact: true }).first().click();
  dialog = owner.getByRole('dialog', { name: 'Invite User', exact: true });
  await dialog.getByLabel('Work email', { exact: true }).fill('revoke@example.test');
  await dialog.getByRole('button', { name: 'Create invitation link', exact: true }).click();
  await dialog.getByLabel('Invitation link', { exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await owner.getByRole('button', { name: 'Revoke invitation for revoke@example.test' }).click();
  await owner.getByText('Revoked', { exact: true }).waitFor();

  await owner.goto(`${url}/teams`);
  await owner.getByRole('button', { name: 'New Team' }).click();
  let teamDialog = owner.getByRole('dialog', { name: 'New Team' });
  await teamDialog.getByLabel('Team Name').fill('Private engineering');
  await teamDialog.getByLabel('Team Key').fill('PRV');
  await teamDialog.getByLabel('Private team').click();
  await teamDialog.getByRole('button', { name: 'Create Team' }).click();
  await owner.getByText('Private engineering', { exact: true }).waitFor();
  let [privateTeam] = await postgres.db.select().from(require('@reka/database').teams).where(require('drizzle-orm').eq(require('@reka/database').teams.key, 'PRV'));
  assert(privateTeam?.isPrivate);
  await owner.getByRole('link', { name: 'Open team Private engineering' }).click();
  await owner.getByRole('heading', { name: 'Private engineering' }).waitFor();
  assert.equal(await owner.getByRole('button', { name: 'Settings' }).count(), 1);
  for (const theme of ['dark', 'light']) for (const width of [1440, 390]) {
    await owner.setViewportSize({ width, height: 900 });
    await owner.evaluate(() => localStorage.removeItem('workspace-e2e'));
    await owner.goto(`${url}/teams/${privateTeam.id}?theme=${theme}`);
    await owner.getByRole('heading', { name: 'Private engineering' }).waitFor();
    assert.equal(await owner.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await owner.screenshot({ path: `/tmp/reka-private-team-${theme}-${width}.png`, fullPage: true });
  }
  await owner.setViewportSize({ width: 1440, height: 900 });
  await owner.goto(`${url}/teams/${privateTeam.id}`);
  await owner.getByRole('heading', { name: 'Private engineering' }).waitFor();
  await owner.getByRole('button', { name: 'Add Member' }).click();
  teamDialog = owner.getByRole('dialog', { name: 'Add Team Member' });
  await teamDialog.getByPlaceholder('Type name or email to search...').fill('member@example.test');
  await teamDialog.getByText('member@example.test', { exact: true }).click();
  await teamDialog.getByRole('combobox').last().click();
  await owner.getByRole('option', { name: 'Viewer', exact: true }).click();
  await teamDialog.getByRole('button', { name: 'Add Member', exact: true }).click();
  await owner.getByText('Team member added', { exact: true }).waitFor();
  await owner.getByRole('tab', { name: 'Members' }).click();
  await owner.getByText('Member', { exact: true }).waitFor();
  assert.equal((await postgres.db.select().from(require('@reka/database').teamMembers).where(require('drizzle-orm').and(require('drizzle-orm').eq(require('@reka/database').teamMembers.teamId, privateTeam.id), require('drizzle-orm').eq(require('@reka/database').teamMembers.userId, people.Member.id))))[0].role, 'viewer');
  const nonMember = await pageFor('Admin');
  await nonMember.goto(`${url}/teams/${privateTeam.id}`);
  await nonMember.getByText('Failed to load team details.').waitFor();
  assert.equal(await nonMember.getByRole('button', { name: 'Add Member' }).count(), 0);
  const privateMember = await pageFor('Member');
  await privateMember.goto(`${url}/teams/${privateTeam.id}`);
  await privateMember.getByRole('heading', { name: 'Private engineering' }).waitFor();
  assert.equal(await privateMember.getByRole('button', { name: 'Settings' }).count(), 0);
  assert.equal(await privateMember.getByRole('button', { name: 'Add Member' }).count(), 0);
  assert.equal(await privateMember.getByRole('button', { name: 'Join team' }).count(), 0);
  await owner.getByRole('button', { name: 'Settings' }).click();
  const settings = owner.getByRole('dialog', { name: 'Team settings' });
  await settings.getByLabel('Private team').click();
  await settings.getByRole('button', { name: 'Save settings' }).click();
  await owner.getByText('Team "Private engineering" updated', { exact: true }).waitFor();
  await postgres.reopen();
  privateTeam = (await postgres.db.select().from(require('@reka/database').teams).where(require('drizzle-orm').eq(require('@reka/database').teams.id, privateTeam.id)))[0];
  assert.equal(privateTeam.isPrivate, false);
  await nonMember.reload();
  await nonMember.getByRole('heading', { name: 'Private engineering' }).waitFor();
  await nonMember.getByRole('button', { name: 'Join team' }).click();
  await nonMember.getByText('Joined team', { exact: true }).waitFor();
  assert.equal((await postgres.db.select().from(require('@reka/database').teamMembers).where(require('drizzle-orm').and(require('drizzle-orm').eq(require('@reka/database').teamMembers.teamId, privateTeam.id), require('drizzle-orm').eq(require('@reka/database').teamMembers.userId, people.Admin.id)))).length, 1);

  for (const theme of ['dark', 'light']) for (const width of [1440, 390]) {
    await owner.setViewportSize({ width, height: 900 });
    await owner.evaluate(() => localStorage.removeItem('workspace-e2e'));
    await owner.goto(`${url}/users?theme=${theme}`);
    await owner.getByText('Revoked', { exact: true }).waitFor();
    assert.equal(await owner.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await owner.screenshot({ path: `/tmp/reka-workspace-real-api-${theme}-${width}.png`, fullPage: true });
    await owner.getByRole('button', { name: 'Invite User', exact: true }).first().click();
    await owner.getByRole('dialog', { name: 'Invite User', exact: true }).waitFor();
    await owner.screenshot({ path: `/tmp/reka-workspace-invite-${theme}-${width}.png` });
    await owner.keyboard.press('Escape');
  }
  assert(requests.includes('POST /api/workspace/invitations'));
  assert(requests.some(value => value.startsWith('PATCH /api/users/')));
  assert.deepEqual(errors, []);
  const failedApi = networkFailures.filter(path => path.startsWith('/api/'));
  assert.deepEqual(failedApi, [], 'No application API transport failure is acceptable');
  if (networkFailures.length) console.log('Non-API dev-server resource failures:', [...new Set(networkFailures)].join(', '));
  console.log('PASS: real UI/API/database invitation issuance, contract-provider verified acceptance, role change, revocation and restart persistence; light/dark desktop/mobile captures. This does not prove live GitHub OAuth, the full application shell or every private-team edge.');
} finally {
  global.fetch = savedFetch;
  for (const [key, value] of Object.entries(savedEnv)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  if (browser) await browser.close();
  if (api) await api.close();
  await postgres.close();
}
