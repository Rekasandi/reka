// Browser -> real Nest Insights API -> isolated PostgreSQL, with four theme/viewport checks.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../../api/test/support/isolated-api.cjs', import.meta.url));
const { createPersistentPostgres } = require('./persistent-postgres.cjs');
const { createIsolatedApi } = require('./isolated-api.cjs');
const { organizations, organizationMembers, users, teams, teamMembers, teamWorkflowStates, sessions, cycles, cycleSnapshots, issues, projects } = require('@reka/database');
const modules = ['teams', 'projects', 'cycles', 'views', 'insights'].map(name => Object.values(require(`../../dist/${name}/${name}.module`))[0]);
const ui = fileURLToPath(new URL('../../../packages/ui/src/index.ts', import.meta.url));
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { chromium } = playwright.chromium ? playwright : playwright.default;
const postgres = await createPersistentPostgres();
let api, browser;
try {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  const [org] = await postgres.db.insert(organizations).values({ name: 'Insights E2E', slug: `insights-e2e-${suffix.toLowerCase()}` }).returning();
  const [owner] = await postgres.db.insert(users).values({ name: 'Insights Owner', email: `insights-${suffix}@example.test`, role: 'owner' }).returning();
  await postgres.db.insert(organizationMembers).values({ organizationId: org.id, userId: owner.id, role: 'owner' });
  const [team] = await postgres.db.insert(teams).values({ organizationId: org.id, name: 'Reporting team', key: `RPT${suffix.slice(0, 4)}` }).returning();
  await postgres.db.insert(teamMembers).values({ teamId: team.id, userId: owner.id, role: 'lead' });
  await postgres.db.insert(teamWorkflowStates).values([
    { teamId: team.id, key: 'queued', name: 'Queued', category: 'unstarted', color: '#888888', position: 0 },
    { teamId: team.id, key: 'working', name: 'Working', category: 'started', color: '#4488ff', position: 1 },
    { teamId: team.id, key: 'shipped', name: 'Shipped', category: 'completed', color: '#44aa77', position: 2 },
  ]);
  const [project] = await postgres.db.insert(projects).values({ organizationId: org.id, teamId: team.id, ownerId: owner.id, name: 'Reporting project', slug: `reporting-${suffix.toLowerCase()}` }).returning();
  const now = new Date(); const [cycle] = await postgres.db.insert(cycles).values({ teamId: team.id, number: 1, name: 'Recorded cycle', startDate: new Date(now.getTime() - 14 * 86400000), endDate: new Date(now.getTime() + 86400000), isCompleted: true }).returning();
  const [issue] = await postgres.db.insert(issues).values({ identifier: `${team.key}-1`, number: 1, title: 'Completed reporting issue', status: 'shipped', priority: 'high', teamId: team.id, projectId: project.id, reporterId: owner.id }).returning();
  await postgres.db.insert(cycleSnapshots).values({ cycleId: cycle.id, snapshotAt: now, totalIssueCount: 3, completedIssueCount: 2, remainingIssueCount: 1, plannedEstimate: 8, completedEstimate: 5, remainingEstimate: 3, missingEstimateCount: 1 });
  const token = randomUUID(); await postgres.db.insert(sessions).values({ id: token, userId: owner.id, expiresAt: new Date(Date.now() + 86400000) });
  api = await createIsolatedApi(postgres, modules);
  browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.setDefaultTimeout(5_000);
  const errors = []; const seenApi = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  page.on('response', async response => { if (new URL(response.url()).pathname.startsWith('/api/') && response.status() >= 400) console.error('Insights API failure:', response.status(), response.url(), (await response.text().catch(() => '')).slice(0, 500)); });
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    seenApi.push(`${request.method()} ${url.pathname}`);
    return route.continue({ url: `${api.url}${url.pathname}${url.search}`, headers: { ...request.headers(), authorization: `Bearer ${token}` } });
  });
  await page.route('**/src/app/main.tsx*', async route => {
    const original = await (await route.fetch()).text(); const version = original.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
    await route.fulfill({ contentType: 'application/javascript', body: `
      import React from '/node_modules/.vite/deps/react.js${version}';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${version}';
      import { QueryClient, QueryClientProvider } from '/node_modules/.vite/deps/@tanstack_react-query.js${version}';
      import { MemoryRouter, Routes, Route } from '/node_modules/.vite/deps/react-router-dom.js${version}';
      import { TooltipProvider } from '/@fs${ui}';
      import { ThemeProvider } from '/src/components/theme/theme-provider.tsx';
      import { InsightsPage } from '/src/features/insights/components/insights-page.tsx';
      import { useAuthStore } from '/src/stores/auth.store.ts';
      import '/src/styles/globals.css';
      useAuthStore.setState({ user: ${JSON.stringify(owner)}, isAuthenticated: true });
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(TooltipProvider, null,
        React.createElement(ThemeProvider, { defaultTheme: new URLSearchParams(location.search).get('theme') || 'dark', storageKey: 'insights-e2e' },
          React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
            React.createElement(MemoryRouter, { initialEntries: ['/insights'] }, React.createElement(Routes, null,
              React.createElement(Route, { path: '/insights', element: React.createElement(InsightsPage) })))))));
    ` });
  });
  const url = process.env.WEB_URL || 'http://localhost:5173';
  await page.goto(`${url}?theme=dark`);
  await page.getByRole('heading', { name: 'Insights', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Completed issues', exact: true }).waitFor();
  await page.getByText('Completed reporting issue', { exact: true }).waitFor();
  const teamFilter = page.getByLabel(/^Team/);
  await teamFilter.selectOption(team.id); await page.waitForTimeout(300);
  await page.getByLabel(/^Project/).selectOption(project.id); await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Cycle delivery' }).click();
  await page.getByLabel(/^Cycle/).selectOption(cycle.id);
  await page.getByLabel(/^Unit/).selectOption('estimate');
  await page.getByRole('heading', { name: 'Cycle velocity', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Burndown samples', exact: true }).waitFor();
  await page.getByRole('rowheader', { name: 'Recorded cycle', exact: true }).waitFor();
  await page.getByText('3', { exact: true }).first().waitFor();
  assert.ok(seenApi.some(path => path.startsWith('GET /api/insights/overview')));
  assert.ok(seenApi.some(path => path.startsWith('GET /api/insights/cycles')));
  for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => localStorage.removeItem('insights-e2e'));
    await page.goto(`${url}?theme=${theme}`); await page.getByRole('heading', { name: 'Insights', exact: true }).waitFor();
    await page.getByText('Completed reporting issue', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${theme} ${width}px overflows horizontally`);
    await page.screenshot({ path: `/tmp/reka-insights-${theme}-${width}.png` });
  }
  assert.deepEqual(errors, []);
  const savedIssue = (await postgres.db.select().from(issues))[0]; assert.equal(savedIssue.id, issue.id);
  console.log('PASS: Insights issue/cycle reports render through real authenticated Nest API and isolated PostgreSQL. Desktop/mobile light/dark screenshots captured; recorded issue and cycle fixture persist.');
} finally { if (browser) await browser.close(); if (api) await api.close(); await postgres.close(); }
