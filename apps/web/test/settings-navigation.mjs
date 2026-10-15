// Actual app router with controlled APIs; no live data, email or provider writes.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch();
const base = process.env.WEB_URL || 'http://localhost:5173';
const out = '/tmp/reka-settings';
await mkdir(out, { recursive: true });
let role = 'owner';
let githubUsername = 'dimaspratama';
let teamsFail = false;
let preferences = { mentions: true, comments: true, assignments: true, issueUpdates: true, projectUpdates: true, github: true, teamInvites: true };
const errors = [];
const requests = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/live.js*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    requests.push(`${request.method()} ${path}`);
    if (teamsFail && path === '/api/teams') return route.fulfill({ status: 503, json: { message: 'Controlled failure' } });
    if (path === '/api/notifications/preferences' && request.method() === 'PUT') preferences = request.postDataJSON();
    const team = { id: 't1', name: 'Engineering', key: 'ENG', canManage: role === 'owner', canWrite: role === 'owner', members: [] };
    const data = path === '/api/auth/me' ? { id: 'u1', name: 'Dimas Pratama', email: 'dimas@example.test', githubUsername, role }
      : path === '/api/workspace' ? { id: 'o1', name: 'REKA', role }
      : path === '/api/teams' ? [team] : path === '/api/teams/t1' ? team
      : path.endsWith('/workflow-states') ? [{ key: 'todo', name: 'To do', category: 'unstarted', color: '#6b7280', isActive: true, position: 0 }]
      : path === '/api/projects' ? [{ id: 'p1', name: 'Booking platform', status: 'planned', teamId: 't1' }]
      : path === '/api/notifications/preferences' ? preferences
      : path.endsWith('/unread-count') ? { count: 0 } : [];
    await route.fulfill({ json: data });
  });
  await page.goto(base + '/issues');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('heading', { name: 'Preferences', exact: true }).waitFor();
  const nav = page.getByRole('navigation', { name: 'Settings navigation', exact: true });
  await nav.waitFor();
  assert.equal(await page.getByRole('link', { name: 'My issues', exact: true }).count(), 0, 'Workspace sidebar is replaced');
  for (const category of ['Personal', 'Issues', 'Projects', 'Integrations', 'Administrations']) await nav.getByText(category, { exact: true }).waitFor();
  assert.equal(requests.some(path => path.includes('/integrations/github')), false, 'Personal settings do not fetch workspace integrations');
  await page.getByRole('combobox', { name: 'Theme', exact: true }).click();
  await page.getByRole('option', { name: 'Light', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.classList.contains('light'));
  await page.reload();
  assert.equal(await page.evaluate(() => localStorage.getItem('reka-theme')), 'light');
  await page.getByRole('button', { name: 'Notification preferences', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Assignments', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(preferences.assignments, false);
  for (const [label, heading, section] of [['Profile', 'Profile', 'profile'], ['Connected accounts', 'Connected accounts', 'accounts'], ['Workflows', 'Workflows', 'workflows'], ['Labels', 'Labels', 'labels'], ['Project settings', 'Project settings', 'projects'], ['GitHub', 'GitHub', 'github'], ['Workspace', 'Workspace', 'workspace'], ['Members', 'Workspace Users', 'members']]) {
    await nav.getByRole('link', { name: label, exact: true }).click();
    await page.waitForURL(`**/settings/${section}`);
    await page.getByRole('heading', { name: heading, exact: true, level: 1 }).waitFor();
    assert.equal(await nav.getByRole('link', { name: label, exact: true }).getAttribute('aria-current'), 'page');
    if (section === 'workflows') {
      await page.getByRole('button', { name: 'Configure workflow' }).click();
      await page.getByRole('dialog', { name: 'Team settings' }).waitFor();
      await page.getByLabel('todo state name').waitFor();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    if (section === 'labels') {
      await page.getByRole('button', { name: 'Manage labels', exact: true }).click();
      await page.getByRole('dialog', { name: 'Manage labels' }).waitFor();
      assert.equal(await page.getByLabel('Label team').inputValue(), 't1');
      await page.keyboard.press('Escape');
    }
  }
  await page.goto(base + '/settings#profile');
  await page.waitForURL('**/settings/profile');
  await page.reload();
  await page.getByRole('heading', { name: 'Profile', exact: true, level: 1 }).waitFor();
  await page.goto(base + '/settings#appearance');
  await page.waitForURL('**/settings/preferences');
  await page.goto(base + '/settings?github=installed');
  await page.waitForURL('**/settings/github');
  await page.getByRole('heading', { name: 'GitHub', exact: true, level: 1 }).waitFor();
  await page.goto(base + '/settings/profile');
  await nav.getByRole('link', { name: 'Connected accounts' }).click();
  await page.goBack();
  await page.waitForURL('**/settings/profile');
  await page.goForward();
  await page.waitForURL('**/settings/accounts');
  for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(theme => localStorage.setItem('reka-theme', theme), theme);
    await page.goto(base + '/settings/preferences');
    await page.getByRole('heading', { name: 'Preferences', exact: true, level: 1 }).waitFor();
    if (width === 390) await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
    await nav.getByRole('link', { name: 'Profile', exact: true }).click();
    await page.getByRole('heading', { name: 'Profile', exact: true, level: 1 }).waitFor();
    if (width === 390) await page.getByRole('dialog', { name: 'Sidebar' }).waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${out}/${theme}-${width}-profile.png` });
    if (width === 1440) {
      await page.getByRole('link', { name: 'Back to workspace' }).click();
      await page.waitForURL('**/dashboard');
      await page.getByRole('link', { name: 'My issues', exact: true }).waitFor();
      assert.equal(await nav.count(), 0, 'Returning to the workspace restores its sidebar');
    }
  }
  role = 'guest'; githubUsername = null;
  await page.goto(base + '/settings/accounts');
  await page.getByText('No verified GitHub identity available', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
  assert.equal(await nav.getByText('Administrations', { exact: true }).count(), 0);
  await page.goto(base + '/settings/workspace');
  await page.getByText('Only workspace owners and admins can manage these settings.').waitFor();
  await page.goto(base + '/settings/workflows');
  await page.getByRole('button', { name: 'Configure workflow' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Configure workflow' }).isDisabled(), true);
  teamsFail = true;
  await page.goto(base + '/settings/workflows');
  await page.getByText('Could not load teams.', { exact: false }).waitFor();
  teamsFail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByRole('button', { name: 'Configure workflow' }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: real settings routes/sidebar, categories, preferences persistence, notifications, workflow/label dialogs, direct/reload/back/forward/legacy URLs, desktop/mobile light/dark and read-only access. Controlled APIs only.');
} finally { await browser.close(); }
