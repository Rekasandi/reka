// UI audit harness. All APIs and auth are mocked; no live data is changed.
// AUDIT_PHASE=before records findings; default asserts regression checks.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ui = fileURLToPath(new URL('../../../packages/ui/src/index.ts', import.meta.url));
const css = fileURLToPath(new URL('../../../packages/ui/src/components/block-editor/style.css', import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const phase = process.env.AUDIT_PHASE || 'after';
const out = process.env.AUDIT_OUT || `/tmp/reka-ui-audit-${phase}`;
await mkdir(out, { recursive: true });
const user = { id: 'u1', name: 'Dimas Pratama', email: 'dimas@example.com', githubUsername: 'dimaspratama', role: 'owner' };
const users = [user, { id: 'u2', name: 'Ayu Wulandari', email: 'ayu@example.com', role: 'member', assignedIssuesCount: 2, teamsCount: 1 }];
const teams = [{ id: 't1', canWrite: true, canManage: true, currentMemberRole: 'lead', name: 'Engineering', key: 'ENG', description: 'Platform and product engineering.', icon: 'CodeXml', memberCount: 2, issueCount: 3, members: users.map((u, index) => ({ teamId: 't1', userId: u.id, role: index ? 'member' : 'lead', user: u })) }, { id: 't2', name: 'Design', key: 'DES', description: 'Product design.', memberCount: 0, issueCount: 0, members: [] }];
const projects = [{ id: 'p1', teamId: 't1', name: 'Guest booking platform', slug: 'guest-booking', description: 'Booking, payments, and guest support.', ownerId: 'u1', status: 'in_progress', health: 'on_track', priority: 'medium', updatedAt: '2026-10-13', targetDate: '2027-02-27', progress: 33, totalIssues: 3, completedIssues: 1 }];
const cycles = [{ id: 'cy1', teamId: 't1', name: 'October delivery', number: 12, description: 'Finish booking flow and payment testing.', status: 'active', isCompleted: false, startDate: '2026-10-01', endDate: '2026-10-20', progress: 33, totalIssues: 3, completedIssues: 1 }];
const issues = ['in_progress', 'todo', 'done'].map((status, index) => ({ id: `i${index}`, identifier: `ENG-${index+1}`, number: index+1, title: ['Implement booking confirmation', 'Test payment reconciliation', 'Review guest checkout'][index], teamId: 't1', projectId: 'p1', cycleId: 'cy1', assigneeId: 'u1', reporterId: 'u1', priority: 'medium', type: 'task', labels: [], sortOrder: index, status, parentId: index === 1 ? 'i0' : null, createdAt: '2026-10-01', updatedAt: '2026-10-13' }));
const clients = [{ id: 'c1', name: 'Bukit Vista Hospitality', industry: 'Travel & Hospitality', notes: 'Guest booking platform.', contactCount: 1, projectCount: 1, contacts: [{ id: 'ct1', name: 'Nadia Putri', email: 'nadia@example.com', role: 'Product lead' }], createdAt: '2026-09-27' }];
const notifications = [{ id: 'n1', userId: 'u1', type: 'assignment', title: 'Booking confirmation assigned to you', body: 'Review the booking confirmation flow before the next release.', read: false, metadata: { issueIdentifier: 'ENG-1' }, createdAt: '2026-10-13T08:00:00Z' }];
const documents = [{ id: 'd1', title: 'Delivery decision log', content: '# Delivery decisions\n\nCapture context, acceptance criteria, and next actions.', projectId: 'p1', teamId: null, archivedAt: null, updatedAt: '2026-10-13' }];
const initiatives = [{ id: 'in1', name: 'Customer experience', description: 'A clear path from discovery to delivery.', ownerId: user.id, status: 'in_progress', health: 'on_track', startDate: '2026-10-01', targetDate: '2027-02-27', projects, projectCount: 1, progress: 33, totalIssues: 3, completedIssues: 1 }];
const roadmap = { initiatives, projects: projects.map(project => ({ ...project, startDate: '2026-10-01', scheduled: true })), milestones: [], dependencies: [] };
const sample = { averageHours: 8, medianHours: 6, sampleSize: 1, missingHistoryCount: 0, points: [] };
const overview = { history: { hasHistory: true, baselineIssueCount: 0 }, throughput: { total: 1, repeatedCompletionEvents: 0, baselineCompletionCount: 0, points: [{ date: '2026-10-13', count: 1 }] }, leadTime: sample, cycleTime: sample, completions: { page: 1, totalPages: 1, total: 1, rows: [{ issueId: 'i2', identifier: 'ENG-3', title: issues[2].title, completedAt: '2026-10-13T08:00:00Z' }] }, quality: { explanation: 'Measured workflow history only.' } };
const favorites = [{ resourceType: 'project', resourceId: 'p1', name: projects[0].name, href: '/projects/p1' }, { resourceType: 'document', resourceId: 'd1', name: documents[0].title, href: '/documents/d1' }];
const components = [
  ['DashboardPage', 'dashboard'], ['InboxPage', 'notifications', 'inbox'], ['IssuesPage', 'issues'], ['IssueDetailPage', 'issues'],
  ['ProjectsPage', 'projects'], ['ProjectDetailPage', 'projects'], ['CyclesPage', 'cycles'], ['CycleDetailPage', 'cycles'],
  ['TeamsPage', 'teams'], ['TeamDetailPage', 'teams'], ['TeamIssuesPage', 'teams'], ['UsersPage', 'users'],
  ['ClientsPage', 'clients'], ['SettingsPage', 'settings'], ['LoginPage', 'auth'], ['NotFoundPage', 'common'],
  ['TriagePage', 'issues', 'triage'], ['FavoritesPage', 'views'], ['DocumentsPage', 'projects'], ['DocumentDetailPage', 'projects'],
  ['InitiativesPage', 'initiatives'], ['InitiativeDetailPage', 'initiatives'], ['RoadmapPage', 'initiatives'], ['InsightsPage', 'insights'],
];
const routes = ['/dashboard', '/inbox', '/my-issues', '/issues', '/projects', '/projects/p1', '/cycles', '/cycles/cy1', '/teams', '/teams/t1', '/teams/t1/issues', '/users', '/clients', '/settings', '/triage', '/favorites', '/documents', '/documents/d1', '/initiatives', '/initiatives/in1', '/roadmap', '/insights', '/login', '/missing'];
const config = [['/dashboard','DashboardPage'], ['/inbox','InboxPage'], ['/my-issues','IssuesPage'], ['/issues','IssuesPage'], ['/projects','ProjectsPage'], ['/projects/:id','ProjectDetailPage'], ['/cycles','CyclesPage'], ['/cycles/:id','CycleDetailPage'], ['/teams','TeamsPage'], ['/teams/:id','TeamDetailPage'], ['/teams/:id/issues','TeamIssuesPage'], ['/users','UsersPage'], ['/clients','ClientsPage'], ['/settings/:section?','SettingsPage'], ['/triage','TriagePage'], ['/favorites','FavoritesPage'], ['/documents','DocumentsPage'], ['/documents/:id','DocumentDetailPage'], ['/initiatives','InitiativesPage'], ['/initiatives/:id','InitiativeDetailPage'], ['/roadmap','RoadmapPage'], ['/insights','InsightsPage']];
const findings = [];
let teamsMode = 'populated';
let favoritesMode = 'populated';
const viewConfig = { filterTab: 'all', viewMode: 'list', groupBy: 'none', sortBy: 'manual', showSubtasks: true, filters: { assigneeIds: [], labelIds: [], priorities: [], projectIds: [] } };
const views = [{ id: 'v1', name: 'Engineering delivery', teamId: 't1', visibility: 'shared', ownerId: 'u1', config: viewConfig }, { id: 'v2', name: 'Design delivery', teamId: 't2', visibility: 'private', ownerId: 'u1', config: viewConfig }];
// Unrelated team fixtures catch accidental workspace-wide submenu destinations.
projects.push({ ...projects[0], id: 'p2', teamId: 't2', name: 'Design system foundations', slug: 'design-system' });
cycles.push({ ...cycles[0], id: 'cy2', teamId: 't2', name: 'Design current cycle' }, { ...cycles[0], id: 'cy3', name: 'Engineering upcoming cycle', status: 'upcoming' });
initiatives.push({ ...initiatives[0], id: 'in2', name: 'Design foundation initiative', projects: [projects[1]] });
teams[1].isPrivate = true;
components.push(['ViewsPage', 'views']);
routes.push('/views', '/issues/i0', ...['preferences', 'profile', 'accounts', 'workflows', 'labels', 'projects', 'github', 'workspace', 'members', 'teams'].map(section => `/settings/${section}`));
config.push(['/views', 'ViewsPage'], ['/issues/:id', 'IssueDetailPage'], ['/settings/teams/:teamId', 'SettingsPage']);
routes.push('/settings/teams/t1', '/teams/t1?tab=members', '/teams/t1?tab=settings');
try {
  const page = await browser.newPage();
  let errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error('Page error:', error.message); });
  await page.route('**/api/**', async route => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (route.request().method() !== 'GET') return route.fulfill({ status: 405, json: { message: 'Audit is read-only' } });
    if (path === '/api/teams' && teamsMode === 'error') return route.fulfill({ status: 503, json: { message: 'Controlled fixture error' } });
    if (path === '/api/favorites' && favoritesMode === 'error') return route.fulfill({ status: 503, json: { message: 'Controlled favorite error' } });
    const data = path === '/api/workspace' ? { id: 'workspace', name: 'REKA', slug: 'reka', role: user.role }
      : path === '/api/documents' ? documents : path === '/api/documents/d1' ? documents[0]
      : path === '/api/initiatives/roadmap' ? roadmap : path === '/api/initiatives' ? initiatives : path === '/api/initiatives/in1' ? initiatives[0]
      : path.endsWith('/recurrence') ? null
      : path === '/api/views' ? views.filter(view => !requestUrl.searchParams.get('teamId') || !view.teamId || view.teamId === requestUrl.searchParams.get('teamId'))
      : path === '/api/favorites' ? (favoritesMode === 'empty' ? [] : favorites) : path === '/api/triage' ? [{ ...issues[0], status: 'triage', statusLabel: 'Triage', description: 'Investigate the steps supplied in the intake form.' }]
      : path === '/api/issue-templates' ? [{ id: 'it1', teamId: 't1', name: 'Bug report', fields: [{ key: 'details', label: 'Details', type: 'textarea', required: true }] }]
      : path === '/api/insights/overview' ? overview
      : path === '/api/insights/cycles' ? { velocity: { points: [], unmeasuredCompletedCycles: 0 }, burndown: { hasHistory: false, points: [] }, quality: { message: 'No snapshots yet.' } }
      : path === '/api/users' ? users : path === '/api/teams' ? (teamsMode === 'empty' ? [] : teams) : path === '/api/teams/t1' ? teams[0]
      : path === '/api/projects' ? projects : path === '/api/projects/p1' ? projects[0] : path === '/api/issues' ? issues
      : /^\/api\/issues\/i\d$/.test(path) ? issues.find(issue => issue.id === path.split('/').at(-1))
      : path === '/api/cycles' ? cycles : path === '/api/cycles/cy1' ? cycles[0] : path === '/api/clients' ? clients
      : path === '/api/notifications' ? notifications : path.endsWith('/unread-count') ? { count: 1 }
      : path === '/api/activities' ? [{ id: 'a1', actorName: user.name, type: 'issue.updated', createdAt: '2026-10-13T08:00:00Z' }]
      : path === '/api/integrations/github/installations' ? [{ id: 'g1', accountLogin: 'rekasandi', accountType: 'Organization', installationId: 123, repositoryCount: 0 }]
      : [];
    return route.fulfill({ json: data });
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
      import { AppLayout } from '/src/components/layout/app-layout.tsx';
      import { useAuthStore } from '/src/stores/auth.store.ts';
      ${components.map(([name, feature, file]) => `import { ${name} } from '/src/features/${feature}/components/${file || name.replace(/Page$/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}-page.tsx';`).join('\n')}
      import '/src/styles/globals.css';
      import '/@fs${css}';
      import { buildBurndownData } from '/src/features/cycles/components/burndown-chart.tsx';
      window.__auditBurndown = buildBurndownData([{ snapshotAt: '2026-10-13T08:00:00Z', remainingIssueCount: 4, remainingEstimate: 8 }], 'issues');
      const params = new URLSearchParams(window.location.search);
      useAuthStore.setState({ user: ${JSON.stringify(user)}, isAuthenticated: true });
      window.__auditSetIdentity = patch => useAuthStore.setState({ user: { ...useAuthStore.getState().user, ...patch } });
      ReactDOM.createRoot(document.getElementById('root')).render(
        React.createElement(TooltipProvider, null, React.createElement(ThemeProvider, { defaultTheme: params.get('theme') || 'dark', storageKey: 'audit-theme' },
          React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
            React.createElement(MemoryRouter, { initialEntries: [params.get('route') || '/dashboard'] },
              React.createElement(Routes, null,
                React.createElement(Route, { path: '/login', element: React.createElement(LoginPage) }),
                React.createElement(Route, { element: React.createElement(AppLayout) },
                  ${config.map(([path, name]) => `React.createElement(Route, { path: '${path}', element: React.createElement(${name}) })`).join(',\n')}),
                React.createElement(Route, { path: '*', element: React.createElement(NotFoundPage) })))))));
    ` });
  });
  for (const theme of ['dark', 'light']) for (const [size, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    for (const route of process.env.AUDIT_SKIP_RENDERS ? [] : routes) {
      errors = [];
      await page.goto(`${process.env.WEB_URL || 'http://localhost:5173'}?route=${encodeURIComponent(route)}&theme=${theme}`);
      await (route.startsWith('/documents/') ? page.getByRole('textbox', { name: 'Document title', exact: true }) : page.locator('h1').first()).waitFor({ timeout: 15000 }).catch(error => errors.push(error.message));
      await page.waitForTimeout(250);
      const result = await page.evaluate(() => ({
        title: document.querySelector('h1')?.textContent ?? document.querySelector('[aria-label="Document title"]')?.value,
        breadcrumb: document.querySelector('[aria-label="breadcrumb"] [aria-current="page"]')?.textContent,
        clippedControls: [...document.querySelectorAll('button, input, select, [role="tab"]')].filter(el => { const r = el.getBoundingClientRect(); return el.checkVisibility() && r.width && r.height && !el.closest('.overflow-x-auto') && (r.left < -1 || r.right > innerWidth + 1); }).map(el => el.getAttribute('aria-label') || el.textContent.trim()).slice(0, 10),
        overflow: document.documentElement.scrollWidth > innerWidth,
        clippedHeadings: [...document.querySelectorAll('h1')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.left < 0 || r.right > innerWidth + 1); }).map(el => el.textContent),
        fakeControls: document.body.textContent.includes('Active Rules') && !!document.querySelector('input[type=checkbox]'),
        dashSeparators: /[—–]/.test(document.body.innerText),
        honestBurndown: window.__auditBurndown?.length === 1 && window.__auditBurndown[0].remaining === 4,
        clippedActions: [...document.querySelectorAll('button')].filter(el => { const r = el.getBoundingClientRect(); return r.width && r.height && /^(New|Create|Save|Invite|End|Reopen|Reply|Connect|Add|Open)/.test(el.textContent.trim()) && (r.left < 0 || r.right > innerWidth + 1); }).map(el => el.textContent),
        decorativeMotion: [...document.querySelectorAll('[class*=animate-pulse]')].filter(el => !el.matches('[data-slot=skeleton]')).length,
        uppercaseLabels: [...document.querySelectorAll('h1,h2,h3,h4,label,button,span,p,th,dt,legend')].filter(el => el.checkVisibility() && el.textContent.trim() && getComputedStyle(el).textTransform === 'uppercase').map(el => el.textContent.trim()),
      }));
      assert.deepEqual(result.uppercaseLabels, [], `${route} ${theme} ${size}: labels retain natural casing`);
      const label = route.replaceAll('/', '-').slice(1);
      await page.screenshot({ path: `${out}/${theme}-${size}-${label}.png` });
      findings.push({ route, theme, size, ...result, errors: [...errors] });
    }
  }
  for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${process.env.WEB_URL || 'http://localhost:5173'}?route=%2Ftriage&theme=${theme}`);
    await page.getByText('Team triage', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    const heading = page.getByRole('heading', { name: 'New template', exact: true });
    await heading.waitFor();
    assert.equal(await heading.evaluate(el => getComputedStyle(el).textTransform), 'none', 'Template heading keeps natural casing');
    assert.equal(await heading.evaluate(el => getComputedStyle(el).letterSpacing), 'normal', 'Template heading has no decorative tracking');
    await page.screenshot({ path: `${out}/triage-templates-${theme}-${width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${process.env.WEB_URL || 'http://localhost:5173'}?route=%2Fmy-issues&theme=dark`);
  await page.getByRole('heading', { name: 'My Issues', exact: true }).waitFor();
  await page.getByTitle('Expand subtasks', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Customize view', exact: true }).click();
  const showSubIssues = page.getByRole('menuitemcheckbox', { name: 'Show sub-issues', exact: true });
  assert.equal(await showSubIssues.getAttribute('data-state'), 'checked');
  await showSubIssues.click();
  await page.getByRole('button', { name: 'Customize view', exact: true }).waitFor();
  assert.equal(await page.getByTitle('Expand subtasks', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Test payment reconciliation', { exact: true }).count(), 0);
  await page.reload();
  await page.getByRole('heading', { name: 'My Issues', exact: true }).waitFor();
  assert.equal(await page.getByTitle('Expand subtasks', { exact: true }).count(), 0, 'View choice persists on reload');
  await page.getByRole('button', { name: 'Customize view', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Show sub-issues', exact: true }).click();
  await page.getByRole('button', { name: 'Board view', exact: true }).click();
  await page.getByText('Test payment reconciliation', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Customize view', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Show sub-issues', exact: true }).click();
  assert.equal(await page.getByText('Test payment reconciliation', { exact: true }).count(), 0, 'Sub-issues are hidden on board as well');
  await page.getByRole('button', { name: 'Customize view', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Show sub-issues', exact: true }).click();
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await page.getByTitle('Expand sub-tasks', { exact: true }).waitFor();

  // Context menu keyboard navigation must not trigger page-level issue shortcuts.
  await page.getByText('Implement booking confirmation', { exact: true }).click({ button: 'right' });
  const taskMenu = page.getByRole('menu', { name: 'Actions for ENG-1', exact: true });
  await taskMenu.getByRole('menuitem', { name: 'Copy issue ID', exact: true }).focus();
  await page.keyboard.press('c');
  assert.equal(await page.getByRole('dialog', { name: 'New Issue', exact: true }).count(), 0);
  await taskMenu.getByRole('menuitem', { name: 'Status', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitemradio', { name: 'Backlog', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // Shared pickers must also update the create form, without submitting on number keys.
  const createdIssues = [];
  await page.route('**/api/issues', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    const data = route.request().postDataJSON();
    createdIssues.push(data);
    return route.fulfill({ json: { ...data, id: 'new-issue', identifier: 'ENG-4', createdAt: '2026-10-13', updatedAt: '2026-10-13' } });
  });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'New Issue', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'New Issue', exact: true });
    await dialog.getByLabel('Title', { exact: true }).fill('Picker consistency check');
    for (const [label, key, selectedName] of [
      ['Status', '4', 'Change status: In Review'],
      ['Priority', '2', 'Change priority: High'],
      ['Type', '2', 'Change issue type: Bug'],
    ]) {
      await dialog.locator(`#${label.toLowerCase()}`).click();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press(key);
      await dialog.getByRole('button', { name: selectedName, exact: true }).waitFor();
    }
    await dialog.locator('#projectId').click();
    await page.getByRole('textbox', { name: 'Search projects', exact: true }).fill('booking');
    await page.getByRole('menuitemradio', { name: 'Guest booking platform', exact: true }).click();
    await dialog.locator('#cycleId').click();
    await page.getByRole('textbox', { name: 'Search cycles', exact: true }).fill('october');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await dialog.locator('#teamId').click();
    await page.getByRole('option', { name: 'Design (DES)', exact: true }).click();
    assert.equal(await dialog.locator('#cycleId').getAttribute('aria-label'), 'Change cycle: No cycle', 'Changing team clears a cycle belonging to the previous team');
    await dialog.locator('#cycleId').click();
    await page.getByRole('textbox', { name: 'Search cycles', exact: true }).fill('october');
    await page.getByText('No cycles found.', { exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await dialog.locator('#teamId').click();
    await page.getByRole('option', { name: 'Engineering (ENG)', exact: true }).click();
    await dialog.locator('#cycleId').click();
    await page.getByRole('textbox', { name: 'Search cycles', exact: true }).fill('october');
    await page.getByRole('menuitemradio', { name: /October delivery/ }).click();
    assert.equal(createdIssues.length, width === 1280 ? 0 : 1, 'Shortcut selection does not submit the form');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/reka-shared-pickers-create-${width}.png` });
    await dialog.getByRole('button', { name: 'Create Issue', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    const data = createdIssues.at(-1);
    assert.deepEqual([data.status, data.priority, data.type, data.projectId, data.cycleId, data.teamId], ['in_review', 'high', 'bug', 'p1', 'cy1', 't1']);
  }
  // New UX acceptance: navigation, meaningful mobile rows, short dialogs and keyboard access.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${process.env.WEB_URL || 'http://localhost:5173'}?route=%2Fdashboard&theme=dark`);
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
  const mobileNav = page.getByRole('dialog', { name: 'Sidebar', exact: true });
  await mobileNav.getByRole('button', { name: 'More workspace pages', exact: true }).click();
  await page.getByRole('menuitem', { name: 'All Issues', exact: true }).click();
  await mobileNav.waitFor({ state: 'hidden' });
  await page.getByRole('heading', { name: 'Issues', exact: true }).waitFor();
  const issueTitle = page.getByRole('button', { name: `Open issue ENG-1: ${issues[0].title}`, exact: true });
  assert.ok(await issueTitle.evaluate(el => el.getBoundingClientRect().width > 150), 'Mobile issue title gets a usable full row');
  await issueTitle.focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-issue-detail="page"]').waitFor();
  assert.equal(await page.getByRole('dialog', { name: 'Issue ENG-1' }).count(), 0, 'Mobile uses the full issue page');
  await page.getByRole('button', { name: 'Back to issues' }).click();
  await page.getByRole('heading', { name: 'Issues', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Skip to content', exact: true }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'workspace-content');

  await page.setViewportSize({ width: 390, height: 480 });
  await page.getByRole('button', { name: 'New Issue', exact: true }).click();
  const shortDialog = page.getByRole('dialog', { name: 'New Issue', exact: true });
  await shortDialog.waitFor();
  const bounds = await shortDialog.boundingBox();
  assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 480, 'Short viewport keeps dialog inside the screen');
  await shortDialog.getByRole('button', { name: 'Create Issue', exact: true }).scrollIntoViewIfNeeded();
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${process.env.WEB_URL || 'http://localhost:5173'}?route=%2Fprojects%2Fp1&theme=dark`);
  await page.getByRole('tab', { name: 'Overview', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  await page.getByRole('heading', { name: 'Documents', exact: true }).waitFor();
  const tabBounds = await page.getByRole('tab', { name: 'Documents', exact: true }).boundingBox();
  assert.ok(tabBounds.x >= 0 && tabBounds.x + tabBounds.width <= 390, 'Offscreen project tabs scroll into view');

  await page.goto(`${process.env.WEB_URL || 'http://localhost:5173'}?route=%2Fprojects&theme=dark`);
  await page.getByRole('textbox', { name: 'Filter projects', exact: true }).or(page.getByRole('searchbox', { name: 'Filter projects', exact: true })).fill('no matching project');
  await page.getByText('No matching projects. Try another search or filter.', { exact: true }).waitFor();
  await page.getByRole('searchbox', { name: 'Filter projects', exact: true }).fill('booking');
  await page.getByRole('link', { name: 'Open project Guest booking platform', exact: true }).waitFor();

  await page.evaluate(() => window.__auditSetIdentity({ githubUsername: null }));
  await page.getByRole('button', { name: 'Open profile menu', exact: true }).click();
  assert.equal(await page.getByText(/github\.com\//).count(), 0, 'Email is not used as a fake GitHub identity');
  await page.getByRole('menuitem', { name: 'Preferences', exact: true }).click();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).click();
  await page.getByRole('option', { name: 'Light', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.classList.contains('light'));
  assert.equal(await page.evaluate(() => localStorage.getItem('audit-theme')), 'light');

  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    issues[0].title = 'Review customer-facing checkout validation and payment failure recovery with the engineering and product teams before release';
    await page.goto(`${process.env.WEB_URL || 'http://localhost:5173'}?route=%2Fissues&theme=dark`);
    await page.getByRole('heading', { name: 'Issues', exact: true }).waitFor();
    const title = page.getByRole('button', { name: `Open issue ENG-1: ${issues[0].title}`, exact: true });
    await title.waitFor();
    assert.ok(await title.evaluate(el => el.getBoundingClientRect().width > 100), `Readable long title at ${width}px`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  for (const mode of ['empty', 'error']) {
    teamsMode = mode;
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${process.env.WEB_URL || 'http://localhost:5173'}?route=%2Fdashboard&theme=dark`);
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
    assert.equal(await page.locator('a[href*="/teams/default"]').count(), 0, 'No fabricated fallback team');
    if (mode === 'empty') await page.getByRole('link', { name: 'Browse teams', exact: true }).waitFor();
    else {
      await page.getByRole('button', { name: 'Retry loading teams', exact: true }).waitFor();
      teamsMode = 'populated';
      await page.getByRole('button', { name: 'Retry loading teams', exact: true }).click();
      await page.getByRole('button', { name: 'Engineering (ENG)', exact: true }).waitFor();
    }
  }
  // Linear sidebar: real destinations, scoped lists, favorites, disclosure and keyboard.
  teamsMode = 'populated';
  for (const theme of ['dark', 'light']) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => localStorage.removeItem('audit-theme'));
    await page.goto(`${process.env.WEB_URL || 'http://localhost:5173'}?route=${encodeURIComponent('/projects?teamId=t1')}&theme=${theme}`);
    await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Open project Guest booking platform', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Open project Design system foundations', exact: true }).count(), 0);
    if (width < 768) await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
    const nav = page.locator('.reka-sidebar-nav:visible');
    await nav.getByRole('button', { name: 'Engineering (ENG)', exact: true }).waitFor();
    assert.deepEqual(await nav.locator('[data-sidebar="group-label"] button').allTextContents(), ['Workspace', 'Favorites', 'Your teams']);
    assert.equal(await nav.getByRole('button', { name: 'Engineering (ENG)', exact: true }).getAttribute('aria-expanded'), 'true');
    assert.equal(await nav.getByRole('button', { name: 'Design (DES)', exact: true }).getAttribute('aria-expanded'), 'false');
    assert.equal(await nav.locator('a[href="/projects?teamId=t1"]').getAttribute('aria-current'), 'page');
    assert.equal(await nav.locator('a[href="/projects"]').getAttribute('aria-current'), null);
    await nav.locator('[aria-label="Private team"]').waitFor();
    assert.equal(await nav.getByRole('link', { name: 'Agent', exact: true }).count(), 0);
    assert.equal(await nav.getByRole('link', { name: 'Loops', exact: true }).count(), 0);
    assert.equal(await nav.locator('a[href="/projects/p1"]').getAttribute('title'), projects[0].name);
    if (!process.env.AUDIT_SKIP_RENDERS || process.env.AUDIT_SIDEBAR_CAPTURE) {
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/sidebar-${theme}-${width}.png`, animations: 'disabled' });
    }
    if (width < 768) assert.ok(await nav.locator('a[href="/cycles?teamId=t1&status=active"]').evaluate(el => el.getBoundingClientRect().height >= 44));
    await nav.locator('a[href="/cycles?teamId=t1&status=active"]').click();
    await page.getByRole('heading', { name: 'Cycles', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Active', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Active', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('link', { name: 'Open cycle October delivery', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Open cycle Design current cycle', exact: true }).count(), 0);
    assert.equal(await page.getByRole('link', { name: 'Open cycle Engineering upcoming cycle', exact: true }).count(), 0);
    if (width < 768) { await page.getByRole('dialog', { name: 'Sidebar', exact: true }).waitFor({ state: 'hidden' }); await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click(); }
    await nav.locator('a[href="/cycles?teamId=t1&status=upcoming"]').click();
    await page.getByRole('link', { name: 'Open cycle Engineering upcoming cycle', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Open cycle October delivery', exact: true }).count(), 0);
    if (width < 768) await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
    await nav.locator('a[href="/initiatives?teamId=t1"]').click();
    await page.getByRole('heading', { name: 'Initiatives', exact: true }).waitFor();
    await page.getByRole('link', { name: /Customer experience/ }).first().waitFor();
    assert.equal(await page.getByRole('link', { name: /Design foundation initiative/ }).count(), 0);
    if (width < 768) await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
    await nav.locator('a[href="/views?teamId=t1"]').click();
    await page.getByRole('heading', { name: 'Views', exact: true }).waitFor();
    await page.getByRole('list', { name: 'Saved views', exact: true }).getByRole('link', { name: /Engineering delivery/ }).waitFor();
    assert.equal(await page.getByRole('list', { name: 'Saved views', exact: true }).getByRole('link', { name: /Design delivery/ }).count(), 0);
    await page.getByRole('textbox', { name: 'Search views', exact: true }).fill('missing view');
    await page.getByText('No matching views', { exact: true }).waitFor();
    await page.getByRole('textbox', { name: 'Search views', exact: true }).fill('');
    await page.getByRole('list', { name: 'Saved views', exact: true }).getByRole('link', { name: /Engineering delivery/ }).click();
    await page.getByRole('button', { name: 'List view', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Saved issue view"]')?.value === 'v1');
    assert.equal(await page.getByRole('button', { name: 'List view', exact: true }).getAttribute('aria-pressed'), 'true');
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${process.env.WEB_URL || 'http://localhost:5173'}?route=${encodeURIComponent('/triage?teamId=t2')}&theme=dark`);
  await page.getByRole('heading', { name: 'Triage', exact: true }).waitFor();
  await page.getByText('Nothing waiting for review', { exact: true }).waitFor();
  assert.equal(await page.getByText('Implement booking confirmation', { exact: true }).count(), 0);
  const sidebar = page.locator('.reka-sidebar-nav:visible');
  await sidebar.getByRole('button', { name: 'Favorites', exact: true }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await sidebar.locator('a[href="/projects/p1"]:visible').count(), 0);
  await page.keyboard.press('Enter');
  await sidebar.locator('a[href="/projects/p1"]').waitFor();
  await sidebar.getByRole('button', { name: 'More workspace pages', exact: true }).focus();
  await page.keyboard.press('Enter');
  const moreMenu = page.getByRole('menu');
  assert.equal(await moreMenu.getByRole('menuitem').count(), 11);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('menu').count(), 0);
  await page.evaluate(() => window.__auditSetIdentity({ role: 'guest' }));
  assert.equal(await sidebar.getByRole('link', { name: 'New team', exact: true }).count(), 0);
  for (const mode of ['empty', 'error']) {
    favoritesMode = mode;
    await page.goto(`${process.env.WEB_URL || 'http://localhost:5173'}?route=%2Fdashboard&theme=dark`);
    if (mode === 'empty') await page.locator('.reka-sidebar-nav').getByRole('link', { name: 'No favorites yet', exact: true }).waitFor();
    else {
      await page.getByRole('button', { name: 'Retry loading favorites', exact: true }).waitFor();
      favoritesMode = 'populated';
      await page.getByRole('button', { name: 'Retry loading favorites', exact: true }).click();
      await page.locator('.reka-sidebar-nav a[href="/projects/p1"]').waitFor();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/results.json`, JSON.stringify(findings, null, 2));
  if (phase !== 'before') {
    assert.deepEqual(findings.filter(item => item.errors.length || item.clippedControls.length || item.breadcrumb === 'Page' || item.breadcrumb === 'Details' || item.overflow || item.clippedHeadings.length || item.clippedActions.length || !item.honestBurndown || item.fakeControls || item.dashSeparators || item.decorativeMotion), []);
  }
  console.log(`${phase.toUpperCase()}: audited ${routes.length} routes in desktop/mobile and dark/light (${findings.length} renders). Findings: ${out}/results.json`);
} finally { await browser.close(); }
