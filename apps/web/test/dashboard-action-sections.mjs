// Mocked API fixtures only. No live issues/projects/cycles are changed.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const ui = fileURLToPath(new URL('../../../packages/ui/src/index.ts', import.meta.url));
const user = { id: 'u1', name: 'Dashboard test user', email: 'test@example.test', role: 'owner' };
const base = { teamId: 't1', assigneeId: 'u1', priority: 'medium', type: 'task', status: 'todo', createdAt: '2026-10-01', updatedAt: '2026-10-12', reporterId: 'u1', sortOrder: 0 };
const issues = [
  { ...base, id: 'blocked', identifier: 'ENG-1', title: 'Blocked integration', status: 'blocked', cycleId: 'cy1', dueDate: '2026-10-12' },
  { ...base, id: 'soon', identifier: 'ENG-2', title: 'Today deadline', cycleId: 'cy1', dueDate: '2026-10-13' },
  { ...base, id: 'review', identifier: 'ENG-3', title: 'Payment review', status: 'in_review', cycleId: 'cy1', dueDate: '2026-10-20' },
  { ...base, id: 'unassigned', identifier: 'DES-1', title: 'Unassigned design', teamId: 't2', cycleId: 'cy2', assigneeId: null },
  { ...base, id: 'done', identifier: 'ENG-4', title: 'Done should be excluded', status: 'done', cycleId: 'cy1', dueDate: '2026-10-12', assigneeId: null },
  { ...base, id: 'canceled', identifier: 'ENG-5', title: 'Canceled should be excluded', status: 'canceled', cycleId: 'cy1', dueDate: '2026-10-13', assigneeId: null },
  { ...base, id: 'outside', identifier: 'DES-2', title: 'Urgent outside date window', teamId: 't2', priority: 'urgent', dueDate: '2026-10-21' },
  { ...base, id: 'invalid', identifier: 'ENG-6', title: 'Invalid date', dueDate: 'invalid' },
  { ...base, id: 'review-empty', identifier: 'DES-3', title: 'Review without PR', status: 'in_review', teamId: 't2', updatedAt: '2026-10-11' },
];
const projects = [
  { id: 'p1', name: 'Upcoming project', status: 'in_progress', health: 'on_track', targetDate: '2026-10-15' },
  { id: 'p2', name: 'Completed project', status: 'completed', health: 'on_track', targetDate: '2026-10-13' },
  { id: 'p3', name: 'Canceled project', status: 'canceled', health: 'on_track', targetDate: '2026-10-16' },
  { id: 'p4', name: 'Late project', status: 'planned', health: 'at_risk', targetDate: '2026-10-12' },
];
const teams = [{ id: 't1', name: 'Engineering', key: 'ENG' }, { id: 't2', name: 'Design', key: 'DES' }];
const cycles = [
  { id: 'cy1', teamId: 't1', number: 1, name: 'Engineering delivery', status: 'active', startDate: '2026-10-01', endDate: '2026-10-20' },
  { id: 'cy2', teamId: 't2', number: 2, name: null, status: 'active', startDate: '2026-10-05', endDate: '2026-10-13' },
  { id: 'cy3', teamId: 't1', number: 3, name: 'Future cycle', status: 'upcoming', startDate: '2026-10-21', endDate: '2026-11-01' },
];
const prs = [
  { id: 'pr1', prNumber: 42, title: 'Payment validation', state: 'open', merged: false, htmlUrl: 'https://github.com/example/reka/pull/42' },
  { id: 'pr2', prNumber: 43, title: 'Payment preparation', state: 'closed', merged: true, htmlUrl: 'https://github.com/example/reka/pull/43' },
];
let mode = 'normal';
let delay = 0;
const requests = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Jakarta' });
  await page.clock.setFixedTime(new Date('2026-10-13T05:00:00Z'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    requests.push(path);
    if (route.request().method() !== 'GET') return route.fulfill({ status: 405, json: { message: 'Read-only check' } });
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if ((mode === 'issues-error' && path === '/api/issues') || (mode === 'prs-error' && path.endsWith('/by-issue/review')) || (mode === 'cycles-error' && path === '/api/cycles') || (mode === 'projects-error' && path === '/api/projects')) return route.fulfill({ status: 500, json: { message: 'Unavailable' } });
    const empty = mode === 'empty';
    const data = path === '/api/issues' ? empty ? [] : issues : path === '/api/projects' ? empty ? [] : projects
      : path === '/api/cycles' ? empty ? [] : cycles : path === '/api/teams' ? teams : path === '/api/users' ? [user]
      : path.endsWith('/by-issue/review') ? prs : path.endsWith('/unread-count') ? { count: 0 } : [];
    await route.fulfill({ json: data });
  });
  await page.route('**/src/app/main.tsx*', async route => {
    const source = await (await route.fetch()).text();
    const version = source.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
    await route.fulfill({ contentType: 'application/javascript', body: `
      import React from '/node_modules/.vite/deps/react.js${version}';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${version}';
      import { QueryClient, QueryClientProvider } from '/node_modules/.vite/deps/@tanstack_react-query.js${version}';
      import { MemoryRouter, Routes, Route } from '/node_modules/.vite/deps/react-router-dom.js${version}';
      import { TooltipProvider } from '/@fs${ui}';
      import { ThemeProvider } from '/src/components/theme/theme-provider.tsx';
      import { DashboardPage } from '/src/features/dashboard/components/dashboard-page.tsx';
      import { useAuthStore } from '/src/stores/auth.store.ts';
      import { attentionReasons, upcomingTargets, workDate } from '/src/features/dashboard/lib/dashboard-work.ts';
      import '/src/styles/globals.css';
      window.dashboardLogic = { attentionReasons, upcomingTargets, workDate };
      useAuthStore.setState({ user: ${JSON.stringify(user)}, isAuthenticated: true });
      ReactDOM.createRoot(document.getElementById('root')).render(
        React.createElement(TooltipProvider, null, React.createElement(ThemeProvider, { defaultTheme: new URLSearchParams(location.search).get('theme') || 'dark', storageKey: 'dashboard-test' },
          React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
            React.createElement(MemoryRouter, { initialEntries: ['/dashboard'] }, React.createElement(Routes, null,
              React.createElement(Route, { path: '/dashboard', element: React.createElement('main', { className: 'p-6' }, React.createElement(DashboardPage)) }),
              React.createElement(Route, { path: '/projects/:id', element: React.createElement('h1', null, 'Project destination') }),
              React.createElement(Route, { path: '/cycles/:id', element: React.createElement('h1', null, 'Cycle destination') })
            ))))));
    ` });
  });
  const url = process.env.WEB_URL || 'http://localhost:5173';
  const section = name => page.getByRole('region', { name, exact: true });
  const attention = section('Needs attention');
  const targets = section('Upcoming targets');
  const active = section('Active cycles');
  const review = section('Waiting for review');
  const ready = async () => { await attention.getByRole('button', { name: /Open issue ENG-1/ }).waitFor(); await review.getByRole('link', { name: /Open pull request #42/ }).waitFor(); };
  await page.goto(url);
  await ready();
  assert.equal(await attention.getByRole('button', { name: /Open issue/ }).count(), 3);
  for (const reason of ['Blocked', 'Overdue', 'Unassigned', 'Urgent']) await attention.getByText(reason, { exact: true }).waitFor();
  assert.equal(await attention.getByRole('button', { name: /Today deadline|Done should|Canceled should|Invalid date/ }).count(), 0);
  assert.equal(await targets.locator('li').count(), 3);
  assert.deepEqual(await targets.locator('li').evaluateAll(rows => rows.map(row => row.textContent)), [
    'ENG-2Today deadlineIssueOct 13', 'Upcoming projectProjectOct 15', 'ENG-3Payment reviewIssueOct 20',
  ]);
  assert.equal(await active.getByRole('link').count(), 2);
  await active.getByText('Engineering', { exact: true }).waitFor();
  await active.getByText('Design', { exact: true }).waitFor();
  await active.getByText('7 days left', { exact: true }).waitFor();
  await active.getByText('Ends today', { exact: true }).waitFor();
  await active.getByText('3 remaining, 1 of 4 completed', { exact: true }).waitFor();
  await active.getByText('1 remaining, 0 of 1 completed', { exact: true }).waitFor();
  await review.getByText('No pull request linked.', { exact: true }).waitFor();
  assert.equal(await review.getByRole('link', { name: /Open pull request #42/ }).getAttribute('href'), prs[0].htmlUrl);
  await review.getByText('Merged', { exact: true }).waitFor();
  assert(requests.filter(path => path.includes('/pull-requests/by-issue/')).every(path => path.endsWith('/review') || path.endsWith('/review-empty')));
  assert.deepEqual(await page.evaluate(() => {
    const { attentionReasons, workDate } = window.dashboardLogic;
    return [workDate('invalid'), attentionReasons({ status: 'done', assigneeId: null, dueDate: '2026-10-01', priority: 'urgent' }), attentionReasons({ status: 'todo', assigneeId: 'u1', dueDate: '2026-10-13', priority: 'medium' })];
  }), [null, [], []]);

  await attention.getByRole('button', { name: /Open issue ENG-1/ }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await targets.getByRole('link', { name: 'Open project Upcoming project', exact: true }).click();
  await page.getByRole('heading', { name: 'Project destination', exact: true }).waitFor();
  await page.goto(url); await ready();
  await active.getByRole('link', { name: 'Open cycle Engineering delivery', exact: true }).click();
  await page.getByRole('heading', { name: 'Cycle destination', exact: true }).waitFor();

  for (const theme of ['dark', 'light']) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${url}?theme=${theme}`); await ready();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/reka-dashboard-actions-${theme}-${width}.png`, fullPage: true });
  }
  mode = 'prs-error'; await page.goto(url);
  await review.getByText('Pull requests unavailable.', { exact: false }).waitFor();
  mode = 'normal'; await review.getByRole('button', { name: 'Retry PRs', exact: true }).click();
  await review.getByRole('link', { name: /Open pull request #42/ }).waitFor();
  for (const [failure, name] of [['issues-error', 'Needs attention'], ['projects-error', 'Upcoming targets'], ['cycles-error', 'Active cycles']]) {
    mode = failure; await page.goto(url);
    await section(name).getByRole('alert').waitFor();
    mode = 'normal'; await section(name).getByRole('button', { name: 'Retry', exact: true }).click();
    await section(name).locator('li').first().waitFor();
  }
  mode = 'empty'; await page.goto(url);
  await attention.getByText('No blocked, overdue, unassigned, or urgent issues.').waitFor();
  await targets.getByText('No issue or project deadlines in the next 7 days.').waitFor();
  await active.getByText('No active cycles.', { exact: false }).waitFor();
  await review.getByText('No issues waiting for review.').waitFor();
  mode = 'normal'; delay = 700; await page.goto(url);
  await attention.getByRole('status').waitFor();
  assert.equal(await attention.getByText('No blocked, overdue, unassigned, or urgent issues.').count(), 0);
  await ready(); delay = 0;
  assert.deepEqual(errors, []);
  console.log('PASS: attention reasons, seven-day sorted issue/project deadlines, multi-team cycle counts/time/navigation, linked PRs, issue sheet, loading/empty/error/retry and dark/light mobile/desktop.');
} finally { await browser.close(); }
