// The actual app shell/router with controlled data. No live records or provider writes.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch();
const base = process.env.WEB_URL || 'http://localhost:5173';
const out = '/tmp/reka-cycles-timeline';
await mkdir(out, { recursive: true });
const now = '2026-10-16T12:00:00Z';
const people = [{ id: 'u1', name: 'Cycle Owner', email: 'owner@example.test', role: 'owner' }];
let readOnly = false, fail = false, historyFail = false, noHistory = false, empty = false;
const requests = [], errors = [];
const teams = [{ id: 't1', name: 'Engineering', key: 'ENG', isPrivate: false, canManage: true, canWrite: true, members: [] }, { id: 't2', name: 'Design', key: 'DES', isPrivate: false, canManage: true, canWrite: true, members: [] }];
const states = ['queued', 'doing', 'shipped', 'canceled'].map((key, position) => ({ teamId: 't1', key, name: key, category: ['unstarted', 'started', 'completed', 'canceled'][position], position, color: '#777777', isActive: true }));
const cycleIssues = ['queued', 'doing', 'doing', 'shipped', 'queued', 'canceled'].map((status, index) => ({ id: `i${index}`, title: 'Cycle work', status, teamId: 't1', cycleId: 'c75', estimate: 2 }));
const cycle = (number, startDate, endDate, status = 'completed', options = {}) => ({ id: `c${number}`, number, name: `Cycle ${number}`, teamId: 't1', startDate, endDate, status, isCompleted: status === 'completed', totalIssues: 5, completedIssues: 1, progress: 20, capacity: 8, plannedEstimate: 10, issues: cycleIssues, createdAt: now, updatedAt: now, ...options });
const cycles = [
  cycle(73, '2026-09-11', '2026-09-25'),
  cycle(78, '2026-11-20', '2026-12-04', 'upcoming', { totalIssues: 0, completedIssues: 0, plannedEstimate: 0, capacity: 0, issues: [] }),
  cycle(75, '2026-10-09', '2026-10-23', 'active'),
  cycle(76, '2026-10-23', '2026-11-06', 'upcoming', { capacity: null, totalIssues: 0, completedIssues: 0, plannedEstimate: 0, issues: [] }),
  cycle(74, '2026-09-25', '2026-10-09'),
  cycle(77, '2026-11-06', '2026-11-19', 'upcoming'),
  cycle(2, '2026-10-10', '2026-10-24', 'active', { id: 'design-cycle', name: 'Design sprint', teamId: 't2', issues: [] }),
];
const snapshots = [
  { id: 's1', cycleId: 'c75', snapshotAt: '2026-10-12T00:00:00Z', totalIssueCount: 4, completedIssueCount: 0, remainingIssueCount: 4 },
  { id: 's2', cycleId: 'c75', snapshotAt: '2026-10-15T00:00:00Z', totalIssueCount: 5, completedIssueCount: 1, remainingIssueCount: 4 },
];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.clock.setFixedTime(new Date(now));
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/live.js*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    requests.push(`${request.method()} ${path}`);
    if (fail && path === '/api/cycles') return route.fulfill({ status: 503, json: { message: 'Controlled failure' } });
    if (historyFail && path.endsWith('/history')) return route.fulfill({ status: 503, json: { message: 'Controlled history failure' } });
    const visibleTeams = teams.map(team => ({ ...team, canManage: !readOnly, canWrite: !readOnly }));
    const data = path === '/api/auth/me' ? { ...people[0], role: readOnly ? 'guest' : 'owner' }
      : path === '/api/workspace' ? { id: 'o1', name: 'REKA', role: readOnly ? 'guest' : 'owner' }
      : path === '/api/teams' ? visibleTeams : path === '/api/users' ? people
      : path.endsWith('/workflow-states') ? states
      : path === '/api/cycles' ? empty ? [] : cycles
      : path.endsWith('/history') ? { snapshots: noHistory ? [] : snapshots, hasHistory: !noHistory }
      : path.startsWith('/api/cycles/') ? cycles.find(cycle => cycle.id === path.split('/')[3]) ?? null
      : path.endsWith('/unread-count') ? { count: 0 } : [];
    return route.fulfill({ json: data });
  });
  await page.goto(`${base}/cycles?teamId=t1`);
  const list = page.getByRole('list', { name: 'Cycles', exact: true });
  await page.getByRole('region', { name: 'Progress for Cycle 75', exact: true }).waitFor().catch(async () => { await page.getByLabel('Progress for Cycle 75', { exact: true }).waitFor(); });
  await page.locator('[data-slot="chart"] .recharts-surface').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Toggle Cycle 75 summary', exact: true }).getAttribute('aria-expanded'), 'true');
  const names = await list.locator('.cycle-timeline-name').allTextContents();
  assert.deepEqual(names, ['Cycle 78', 'Cycle 77', 'Cycle 76', 'Cycle 75', 'Cycle 74', 'Cycle 73']);
  assert.equal(await page.getByText('Design sprint', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Cycle break', { exact: true }).count(), 1);
  assert.equal(requests.filter(value => value.endsWith('/history')).every(value => value === 'GET /api/cycles/c75/history'), true, 'Closed cycles do not fetch history');
  assert.match(await page.getByLabel('Cycle progress summary', { exact: true }).innerText(), /Started\s+2\s*·\s*40%/);
  const chartData = await page.evaluate(async ({ cycle, snapshots, now }) => {
    const { buildCycleProgressData } = await import('/src/features/cycles/components/cycle-progress-chart.tsx');
    return buildCycleProgressData(cycle, snapshots, new Date(now).getTime(), 2);
  }, { cycle: cycles.find(cycle => cycle.id === 'c75'), snapshots, now });
  assert.equal(chartData[0].scope, undefined, 'No scope is backfilled at cycle start');
  assert.equal(chartData.at(-1).scope, undefined, 'The future guide endpoint is not a measurement');
  assert.equal(chartData.filter(point => point.started !== undefined).length, 1, 'Started has one current observation, not invented history');
  assert.deepEqual(chartData.filter(point => point.scope !== undefined).map(point => point.scope), [4, 5, 5]);
  assert.match(await list.locator('li[data-cycle-status="active"] .cycle-capacity').innerText(), /125%/);
  assert.match(await list.locator('li').filter({ has: page.getByRole('button', { name: 'Toggle Cycle 76 summary', exact: true }) }).innerText(), /No capacity set/);
  assert.match(await list.locator('li').filter({ has: page.getByRole('button', { name: 'Toggle Cycle 78 summary', exact: true }) }).innerText(), /0%/);
  await page.getByRole('button', { name: 'Toggle Cycle 75 summary', exact: true }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.getByLabel('Progress for Cycle 75', { exact: true }).count(), 0);
  await page.keyboard.press('Space');
  await page.getByLabel('Progress for Cycle 75', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Toggle Cycle 74 summary', exact: true }).click();
  await page.getByRole('button', { name: 'Design (DES)', exact: true }).click();
  await page.locator('a[href="/cycles?teamId=t2"]').click();
  await page.getByLabel('Progress for Design sprint', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'New Cycle', exact: true }).click();
  const designCreate = page.getByRole('dialog', { name: 'New Cycle', exact: true });
  assert.match(await designCreate.getByRole('combobox').innerText(), /Design/);
  await designCreate.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Schedule settings', exact: true }).click();
  const designSchedule = page.getByRole('dialog', { name: 'Cycle schedule', exact: true });
  assert.match(await designSchedule.getByRole('combobox', { name: 'Cycle schedule team', exact: true }).innerText(), /Design/);
  await designSchedule.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('a[href="/cycles?teamId=t1"]').click();
  await page.getByLabel('Progress for Cycle 75', { exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Current', exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.get('teamId'), 't1');
  assert.equal(new URL(page.url()).searchParams.get('status'), 'active');
  await list.locator('.cycle-timeline-name').nth(1).waitFor({ state: 'hidden' });
  assert.equal(await list.locator('.cycle-timeline-name').count(), 1);
  await page.reload();
  await page.getByLabel('Progress for Cycle 75', { exact: true }).waitFor();
  assert.equal(await page.getByRole('tab', { name: 'Current', exact: true }).getAttribute('aria-selected'), 'true');
  await page.getByRole('tab', { name: 'All cycles', exact: true }).click();
  await page.waitForURL(url => !url.searchParams.has('status'));
  await page.goBack();
  await page.waitForURL(url => url.searchParams.get('status') === 'active');
  assert.equal(new URL(page.url()).searchParams.get('status'), 'active');
  await page.getByRole('button', { name: 'New Cycle', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'New Cycle', exact: true });
  await create.waitFor();
  assert.match(await create.getByRole('combobox').innerText(), /Engineering/);
  await create.getByRole('button', { name: 'Cancel', exact: true }).click();
  for (const theme of ['dark', 'light']) for (const width of [2400, 1440, 900, 390, 320]) {
    await page.addInitScript(theme => localStorage.setItem('reka-theme', theme), theme);
    await page.setViewportSize({ width, height: width === 2400 ? 1632 : 1000 });
    await page.goto(`${base}/cycles?teamId=t1`);
    await page.getByLabel('Progress for Cycle 75', { exact: true }).waitFor();
    await page.locator('[data-slot="chart"] .recharts-surface').waitFor();
    await page.screenshot({ path: `${out}/${theme}-${width}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.cycles-timeline-page button, .cycles-timeline-page a')].filter(element => { const rect = element.getBoundingClientRect(); return element.checkVisibility() && (rect.left < -1 || rect.right > innerWidth + 1); }).map(element => element.getAttribute('aria-label') || element.textContent)), []);
  }
  historyFail = true;
  await page.goto(`${base}/cycles?teamId=t1&status=active`);
  await page.getByRole('button', { name: 'Retry history', exact: true }).waitFor();
  historyFail = false;
  await page.getByRole('button', { name: 'Retry history', exact: true }).click();
  await page.locator('[data-slot="chart"] .recharts-surface').waitFor();
  noHistory = true;
  await page.reload();
  await page.getByText('No delivery history yet.', { exact: false }).waitFor();
  assert.equal(await page.locator('.recharts-line-dots').count() > 0, true, 'An active cycle still has current measurements, not an invented history');
  readOnly = true;
  await page.reload();
  await page.getByLabel('Progress for Cycle 75', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'New Cycle', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Schedule settings', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Actions for Cycle 75', exact: true }).click();
  assert.equal(await page.getByRole('menuitem', { name: 'End Cycle', exact: true }).count(), 0);
  await page.keyboard.press('Escape');
  empty = true;
  await page.reload();
  await page.getByText('No cycles yet', { exact: true }).waitFor();
  fail = true;
  await page.reload();
  await page.getByRole('alert').filter({ hasText: 'Could not load cycles.' }).waitFor();
  fail = false; empty = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByLabel('Progress for Cycle 75', { exact: true }).waitFor();
  assert.equal(requests.some(value => /^(POST|PATCH|PUT|DELETE) /.test(value)), false, 'UI inspection performs no mutations');
  assert.deepEqual(errors, []);
  console.log('PASS: Cycles timeline ordering, real-category current Started, capacity/zero/unset, lazy history, filters/team scope/reload/history, keyboard collapse, scoped create, read-only, empty/retry/no-history, and 10 viewport/theme captures. Controlled APIs only.');
} finally { await browser.close(); }
