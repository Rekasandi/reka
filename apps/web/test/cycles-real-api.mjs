// Authenticated browser → Nest HTTP → isolated PostgreSQL cycle acceptance test.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../../api/test/support/isolated-api.cjs', import.meta.url));
const { createPersistentPostgres } = require('./persistent-postgres.cjs');
const { createIsolatedApi } = require('./isolated-api.cjs');
const { organizations, organizationMembers, users, teams, teamMembers, teamWorkflowStates, sessions, cycles, issues, teamCycleSettings } = require('@reka/database');
const { eq } = require('drizzle-orm');
const { captureCurrentCycleSnapshots } = await import('../../worker/dist/processors/cycle-planning.js');
const modules = ['cycles', 'issues', 'teams', 'users', 'projects'].map(name => Object.values(require(`../../dist/${name}/${name}.module`))[0]);
const { RedisService } = require('../../dist/common/redis/redis.service');
const ui = fileURLToPath(new URL('../../../packages/ui/src/index.ts', import.meta.url));
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { chromium } = playwright.chromium ? playwright : playwright.default;
const postgres = await createPersistentPostgres();
let api, browser;
try {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
  const [org] = await postgres.db.insert(organizations).values({ name: 'Cycle E2E', slug: `cycle-e2e-${suffix.toLowerCase()}` }).returning();
  const [owner] = await postgres.db.insert(users).values({ name: 'Cycle E2E Owner', email: `cycle-e2e-${suffix}@example.test`, role: 'owner' }).returning();
  await postgres.db.insert(organizationMembers).values({ organizationId: org.id, userId: owner.id, role: 'owner' });
  const [team] = await postgres.db.insert(teams).values({ organizationId: org.id, name: 'Cycle E2E team', key: `CYC${suffix.slice(0, 4)}` }).returning();
  await postgres.db.insert(teamMembers).values({ teamId: team.id, userId: owner.id, role: 'lead' });
  await postgres.db.insert(teamWorkflowStates).values([
    { teamId: team.id, key: 'backlog', name: 'Backlog', category: 'backlog', color: '#777777', position: 0 },
    { teamId: team.id, key: 'todo', name: 'Todo', category: 'unstarted', color: '#777777', position: 1 },
    { teamId: team.id, key: 'doing', name: 'In Progress', category: 'started', color: '#777777', position: 2 },
    { teamId: team.id, key: 'shipped', name: 'Shipped', category: 'completed', color: '#777777', position: 3 },
    { teamId: team.id, key: 'triage', name: 'Triage', category: 'triage', color: '#777777', position: 4 },
    { teamId: team.id, key: 'canceled', name: 'Canceled', category: 'canceled', color: '#777777', position: 5 },
  ]);
  const now = new Date();
  const start = new Date(now.getTime() - 2 * 86400000);
  const end = new Date(now.getTime() + 3 * 86400000);
  const nextEnd = new Date(end.getTime() + 10 * 86400000);
  const [cycle, nextCycle] = await postgres.db.insert(cycles).values([
    { teamId: team.id, number: 1, name: 'Browser cycle', startDate: start, endDate: end, capacity: 15 },
    { teamId: team.id, number: 2, name: 'Browser next cycle', startDate: end, endDate: nextEnd },
  ]).returning();
  const [activeIssue, completedIssue] = await postgres.db.insert(issues).values([
    { identifier: `${team.key}-1`, number: 1, title: 'Measured remaining work', teamId: team.id, reporterId: owner.id, status: 'doing', cycleId: cycle.id, estimate: 5 },
    { identifier: `${team.key}-2`, number: 2, title: 'Measured completed work', teamId: team.id, reporterId: owner.id, status: 'shipped', cycleId: cycle.id, estimate: 3 },
  ]).returning();
  await captureCurrentCycleSnapshots(postgres.db, new Date(now.getTime() - 7 * 3600000));
  await postgres.db.update(issues).set({ estimate: 3 }).where(eq(issues.id, activeIssue.id));
  await captureCurrentCycleSnapshots(postgres.db, now);
  const token = randomUUID();
  await postgres.db.insert(sessions).values({ id: token, userId: owner.id, expiresAt: new Date(Date.now() + 86400000) });
  api = await createIsolatedApi(postgres, modules, [[RedisService, { getClient: () => { throw new Error('Redis intentionally unavailable in this isolated browser test'); } }]]);
  browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  page.on('response', async response => { if (new URL(response.url()).pathname.startsWith('/api/') && response.status() >= 400) console.error('Cycle API failure:', response.status(), response.url(), (await response.text().catch(() => '')).slice(0, 500)); });
  const seenApi = [];
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    seenApi.push(`${request.method()} ${path}`);
    return route.continue({ url: `${api.url}${path}${new URL(request.url()).search}`, headers: { ...request.headers(), authorization: `Bearer ${token}` } });
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
      import { CyclesPage } from '/src/features/cycles/components/cycles-page.tsx';
      import { CycleDetailPage } from '/src/features/cycles/components/cycle-detail-page.tsx';
      import { useAuthStore } from '/src/stores/auth.store.ts';
      import '/src/styles/globals.css';
      useAuthStore.setState({ user: ${JSON.stringify(owner)}, isAuthenticated: true });
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(TooltipProvider, null,
        React.createElement(ThemeProvider, { defaultTheme: new URLSearchParams(location.search).get('theme') || 'dark', storageKey: 'cycle-e2e' },
          React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
            React.createElement(MemoryRouter, { initialEntries: [new URLSearchParams(location.search).get('page') === 'detail' ? '/cycles/${cycle.id}' : '/cycles'] },
              React.createElement(Routes, null,
                React.createElement(Route, { path: '/cycles', element: React.createElement(CyclesPage) }),
                React.createElement(Route, { path: '/cycles/:id', element: React.createElement(CycleDetailPage) })))))));
    ` });
  });
  const url = process.env.WEB_URL || 'http://localhost:5173';
  await page.goto(`${url}?page=cycles`);
  await page.getByRole('heading', { name: 'Cycles', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Schedule settings' }).click();
  const schedule = page.getByRole('dialog', { name: 'Cycle schedule' });
  await schedule.waitFor();
  await schedule.locator('input[aria-label="Cycle timezone"]').fill('UTC');
  await schedule.locator('input[aria-label="Cycle duration days"]').fill('14');
  await schedule.locator('input[aria-label="Cycle cooldown days"]').fill('1');
  const scheduledDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  await schedule.locator('input[aria-label="Next cycle start date"]').fill(scheduledDate);
  await schedule.locator('input[aria-label="Automatically create cycles"]').check();
  const saveSettings = page.waitForResponse(response => response.request().method() === 'PUT' && new URL(response.url()).pathname === `/api/cycles/settings/${team.id}`);
  await schedule.getByRole('button', { name: 'Save schedule' }).click();
  assert.equal((await saveSettings).status(), 200);
  await schedule.waitFor({ state: 'hidden' });
  const savedSettings = (await postgres.db.select().from(teamCycleSettings).where(eq(teamCycleSettings.teamId, team.id)))[0];
  assert.equal(savedSettings.autoCreate, true); assert.equal(savedSettings.durationDays, 14); assert.equal(savedSettings.cooldownDays, 1); assert.equal(savedSettings.nextStartDate, scheduledDate);

  await page.getByRole('link', { name: 'Open cycle Browser cycle' }).click();
  await page.getByRole('heading', { name: 'Browser cycle', exact: true }).waitFor();
  await page.getByText('Delivery history', { exact: true }).waitFor();
  await page.getByText('15 pts', { exact: true }).waitFor();
  await page.getByText('9 pts capacity remaining', { exact: true }).waitFor();
  await page.getByText('Measured remaining work', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Complete Cycle...' }).click();
  const complete = page.getByRole('dialog', { name: 'Complete Browser cycle' });
  await complete.getByRole('button', { name: 'Complete & Rollover' }).click();
  await complete.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Reopen cycle' }).waitFor();
  const movedIssue = (await postgres.db.select().from(issues).where(eq(issues.id, activeIssue.id)))[0];
  assert.equal(movedIssue.cycleId, nextCycle.id); assert.equal(movedIssue.status, 'doing', 'active work retains its workflow status through rollover');
  const savedCycle = (await postgres.db.select().from(cycles).where(eq(cycles.id, cycle.id)))[0];
  assert.equal(savedCycle.isCompleted, true);
  assert.ok(seenApi.some(entry => entry === 'PUT /api/cycles/settings/' + team.id));
  assert.ok(seenApi.some(entry => entry === 'POST /api/cycles/' + cycle.id + '/complete'));

  for (const theme of ['dark', 'light']) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => localStorage.removeItem('cycle-e2e'));
    await page.goto(`${url}?page=detail&theme=${theme}`);
    await page.getByText('Delivery history', { exact: true }).waitFor();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${theme} ${width}px has no horizontal overflow`);
    await page.screenshot({ path: `/tmp/reka-cycles-${theme}-${width}.png` });
  }
  assert.deepEqual(errors, []);
  assert.ok(seenApi.some(entry => entry.includes('/history')), 'history is served by the real API');
  console.log('PASS: authenticated browser → Nest HTTP → isolated Postgres cycle settings, capacity, measured history, atomic rollover and persistence. Desktop/mobile light/dark captures show no horizontal overflow. Worker scheduling and snapshot capture are separately covered by cycle-planning integration tests.');
} finally { if (browser) await browser.close(); if (api) await api.close(); await postgres.close(); }
