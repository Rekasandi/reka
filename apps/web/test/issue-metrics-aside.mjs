// Authenticated browser test for IssueMetricsAside panel in issues view.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await (playwright.chromium || playwright.default.chromium).launch();
const base = process.env.WEB_URL || 'http://localhost:5173';
const out = '/tmp/reka-issue-metrics-aside';
await mkdir(out, { recursive: true });

const now = '2026-10-16T12:00:00Z';
const people = [
  { id: 'u1', name: 'Dimas Pratama', email: 'dimas@example.test', role: 'owner' },
  { id: 'u2', name: 'Ayu Lestari', email: 'ayu@example.test', role: 'member' },
];
const teams = [{ id: 't1', name: 'Engineering', key: 'ENG', isPrivate: false, canManage: true, canWrite: true, members: [] }];
const statuses = ['todo', 'in_progress', 'in_review', 'done'];
const priorities = ['no_priority', 'low', 'medium', 'high', 'urgent'];

const issues = Array.from({ length: 40 }, (_, i) => ({
  id: `i${i}`,
  identifier: `ENG-${i + 1}`,
  number: i + 1,
  title: `Issue ${i + 1} task item`,
  teamId: 't1',
  status: statuses[i % statuses.length],
  priority: priorities[i % priorities.length],
  assigneeId: i % 3 === 0 ? 'u1' : i % 3 === 1 ? 'u2' : null,
  reporterId: 'u1',
  estimate: (i % 5) + 1,
  createdAt: now,
  updatedAt: now,
  sortOrder: i,
}));

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.route('**/live.js*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    const data = path === '/api/auth/me' ? { ...people[0], role: 'owner' }
      : path === '/api/workspace' ? { id: 'o1', name: 'REKA', role: 'owner' }
      : path === '/api/teams' ? teams
      : path === '/api/users' ? people
      : path.endsWith('/labels') ? []
      : path.endsWith('/views') ? []
      : path.endsWith('/favorites') ? []
      : path === '/api/projects' ? []
      : path === '/api/issues' ? issues
      : path.endsWith('/unread-count') ? { count: 0 } : [];
    return route.fulfill({ json: data });
  });

  await page.goto(`${base}/issues`);
  const insightsBtn = page.getByRole('button', { name: 'Toggle metrics insight', exact: true });
  await insightsBtn.waitFor();

  // 1. Open the aside on desktop
  await insightsBtn.click();
  const panel = page.locator('#issue-metrics-panel');
  await panel.waitFor();
  assert.equal(await panel.isVisible(), true);

  // 2. Total count verification
  await panel.getByText('40', { exact: true }).waitFor();
  await panel.getByText('issues', { exact: true }).waitFor();

  // 3. Recharts chart rendered
  await panel.locator('.recharts-surface').waitFor();

  // 4. Table rendered
  await panel.locator('table').waitFor();
  assert.equal(await panel.locator('tbody tr').count(), 4, '4 status rows rendered by default');

  // Screenshot in dark mode desktop
  await page.screenshot({ path: `${out}/dark-1440.png`, fullPage: true });

  // 5. Change Slice to Priority
  await panel.getByLabel('Slice', { exact: true }).selectOption('priority');
  await panel.getByRole('columnheader', { name: 'priority', exact: true }).waitFor();
  assert.equal(await panel.locator('tbody tr').count(), 5, '5 priority rows rendered');

  // 6. Change Measure to Estimate
  await panel.getByLabel('Measure', { exact: true }).selectOption('estimate');
  await panel.getByText('estimate points', { exact: true }).waitFor();

  // 7. Change Segment to Status
  await panel.getByLabel('Segment', { exact: true }).selectOption('status');
  await panel.getByRole('columnheader', { name: /Todo/ }).waitFor();

  // 8. "Set default for everyone" button
  await panel.getByRole('button', { name: 'Set default for everyone', exact: true }).click();
  await page.getByText('Metrics configuration saved as default').waitFor();

  // 9. Reset selectors and capture in light mode
  await panel.getByLabel('Slice', { exact: true }).selectOption('status');
  await panel.getByLabel('Measure', { exact: true }).selectOption('issue_count');
  await panel.getByLabel('Segment', { exact: true }).selectOption('priority');

  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.evaluate(() => document.documentElement.classList.add('light'));
  await page.screenshot({ path: `${out}/light-1440.png`, fullPage: true });

  // 10. Close aside via X button
  await panel.getByRole('button', { name: 'Close metrics', exact: true }).click();
  assert.equal(await panel.isVisible(), false);

  // 11. Mobile sheet verification
  await page.setViewportSize({ width: 390, height: 800 });
  await page.evaluate(() => document.documentElement.classList.remove('light'));
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.goto(`${base}/issues`);

  const mobileMetricsBtn = page.getByRole('button', { name: 'Issue metrics', exact: true });
  await mobileMetricsBtn.waitFor();
  await mobileMetricsBtn.click();

  const sheet = page.locator('[data-slot="sheet-content"]');
  await sheet.waitFor();
  await page.waitForTimeout(350);
  assert.equal(await sheet.isVisible(), true);
  await sheet.getByText('40', { exact: true }).waitFor();
  await sheet.locator('.recharts-surface').waitFor();
  await page.screenshot({ path: `${out}/dark-390.png` });

  // Close sheet
  await sheet.getByRole('button', { name: 'Close metrics', exact: true }).click();
  await sheet.waitFor({ state: 'hidden' });

  assert.deepEqual(errors, []);
  console.log('PASS: IssueMetricsAside desktop aside, mobile sheet, slice/measure/segment calculations, chart, table, footer, theme captures. Controlled APIs only.');
} finally {
  await browser.close();
}
