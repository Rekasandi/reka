// Actual application/router, controlled API fixtures; never changes live data.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const base = process.env.WEB_URL || 'http://localhost:5173';
const out = '/tmp/reka-triage-workbench';
await mkdir(out, { recursive: true });
const owner = { id: 'u1', name: 'Dimas Pratama', email: 'dimas@example.test', role: 'owner' };
const member = { id: 'u2', name: 'Ayu Wulandari', email: 'ayu@example.test', role: 'member' };
const teams = [{ id: 't1', name: 'Engineering', key: 'ENG', isPrivate: false, canWrite: true, canManage: true, members: [{ userId: 'u1' }, { userId: 'u2' }] }, { id: 't2', name: 'Finance', key: 'FIN', isPrivate: true, canWrite: true, canManage: true, members: [{ userId: 'u2' }] }];
const initial = Array.from({ length: 6 }, (_, index) => ({
  id: `i${index + 1}`, identifier: `${index === 3 ? 'FIN' : 'ENG'}-${index + 1}`, number: index + 1,
  title: index === 0 ? 'Include explicit currency codes in spend report exports and keep reconciliation understandable for every reporting team' : ['Currency export', 'Preview expense policy changes before publication', 'Prevent webhook delivery to disabled integrations', 'Review finance policy', 'Existing export issue', 'Archived request'][index],
  description: 'Include ISO currency codes alongside monetary amounts in spend report exports.\n\nDistinguish transaction currency from reporting currency and verify the headers and values.',
  status: index < 4 ? 'triage' : 'todo', statusCategory: index < 4 ? 'triage' : 'unstarted', statusLabel: index < 4 ? 'Triage' : 'Todo',
  teamId: index === 3 ? 't2' : 't1', priority: 'no_priority', type: 'task', reporterId: 'u1', assigneeId: null, labels: [],
  archivedAt: index === 5 ? '2026-10-10T08:00:00Z' : null, createdAt: index === 2 ? 'invalid' : '2026-10-14T08:00:00Z', updatedAt: '2026-10-14T08:00:00Z',
}));
let issues, user, mode, failAction, notes, actionGate;
const requests = [], errors = [];
const reset = () => { issues = structuredClone(initial); user = { ...owner }; mode = ''; failAction = false; notes = []; };
reset();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/live.js*', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    const method = request.method(), body = method === 'GET' ? null : request.postDataJSON();
    requests.push({ path, method, body });
    const readOnly = ['guest', 'client'].includes(user.role) || mode === 'readOnly';
    const visibleTeams = teams.map(team => ({ ...team, canWrite: !readOnly, canManage: !readOnly }));
    if (mode === 'queueError' && path === '/api/triage') return route.fulfill({ status: 503, json: { message: 'Queue unavailable' } });
    if (mode === 'slow' && path === '/api/triage') await new Promise(resolve => setTimeout(resolve, 500));
    if (mode === 'detailError' && path === '/api/issues/i1') return route.fulfill({ status: 404, json: { message: 'Issue unavailable' } });
    if (mode === 'templateError' && path === '/api/issue-templates') return route.fulfill({ status: 503, json: { message: 'Templates unavailable' } });
    const action = path.match(/^\/api\/triage\/([^/]+)\/(accept|decline|duplicate)$/);
    if (method === 'POST' && action) {
      await new Promise(resolve => setTimeout(resolve, 250));
      if (actionGate) await actionGate;
      if (failAction) return route.fulfill({ status: 409, json: { message: 'Controlled decision conflict. Please retry.' } });
      const item = issues.find(issue => issue.id === action[1]);
      if (action[2] === 'accept') Object.assign(item, body, { statusCategory: 'unstarted' });
      else item.archivedAt = new Date().toISOString();
      return route.fulfill({ json: item });
    }
    const detail = path.match(/^\/api\/issues\/([^/]+)$/);
    if (detail && method === 'PATCH') { const item = issues.find(issue => issue.id === detail[1]); Object.assign(item, body); return route.fulfill({ json: item }); }
    if (method === 'POST' && path.startsWith('/api/comments/by-issue/')) { const note = { id: 'note1', authorId: 'u1', authorName: owner.name, body: body.body, createdAt: '2026-10-16T08:00:00Z' }; notes.push(note); return route.fulfill({ json: note }); }
    if (method === 'POST' && path.endsWith('/submit')) { const intake = { ...initial[0], id: 'new', identifier: 'ENG-7', title: body.title }; issues.unshift(intake); return route.fulfill({ json: intake }); }
    const template = { id: 'it1', teamId: 't1', name: 'Bug report', fields: [{ key: 'details', label: 'What should we know?', type: 'textarea', required: true }] };
    const data = path === '/api/auth/me' ? user
      : path === '/api/workspace' ? { id: 'w1', name: 'REKA', slug: 'reka', role: user.role }
      : path === '/api/teams' ? visibleTeams : /^\/api\/teams\/t[12]$/.test(path) ? visibleTeams.find(team => team.id === path.split('/').at(-1))
      : path.endsWith('/workflow-states') ? (mode === 'workflowError' ? [] : ['triage', 'todo', 'in_progress', 'done'].map((key, position) => ({ key, name: key, category: ['triage', 'unstarted', 'started', 'completed'][position], isActive: true, position, color: '#777777' })))
      : path === '/api/users' ? [owner, member]
      : path === '/api/triage' ? issues.filter(issue => issue.statusCategory === 'triage' && !issue.archivedAt)
      : path === '/api/issues' ? issues.filter(issue => !issue.archivedAt)
      : detail ? issues.find(issue => issue.id === detail[1])
      : path === '/api/issue-templates' ? [template]
      : path.startsWith('/api/comments/by-issue/') ? notes
      : path.startsWith('/api/activities/by-issue/') ? [{ id: 'a1', actorName: owner.name, type: 'issue.triage_submitted', createdAt: '2026-10-14T08:00:00Z' }]
      : path.endsWith('/subscription') ? { subscribed: false } : path.endsWith('/recurrence') ? null
      : path.endsWith('/unread-count') ? { count: 0 } : [];
    await route.fulfill({ json: data });
  });
  const open = async (path = '/triage', theme = 'dark') => {
    await page.addInitScript(theme => localStorage.setItem('reka-theme', theme), theme);
    await page.goto(base + path);
    await page.locator('.triage-page').waitFor();
  };
  const item = id => page.locator(`[data-triage-item="${id}"]`);
  const panel = page.locator('[data-issue-detail="triage"]');
  await open();
  await panel.getByLabel('Issue title', { exact: true }).waitFor();
  assert.equal(await item('i1').getAttribute('aria-current'), 'true');
  assert.equal(await panel.getByRole('tab', { name: /Activity/ }).getAttribute('data-state'), 'active');
  await item('i2').focus(); await page.keyboard.press('Enter');
  await page.waitForURL('**/triage?issueId=i2');
  await page.waitForFunction(title => document.querySelector('[data-issue-detail="triage"] [aria-label="Issue title"]')?.value === title, initial[1].title);
  assert.equal(await panel.getByLabel('Issue title', { exact: true }).inputValue(), initial[1].title);
  await page.goBack(); await item('i1').waitFor();
  await page.goForward(); await page.reload();
  await panel.getByLabel('Issue title', { exact: true }).waitFor();
  assert.equal(await panel.getByLabel('Issue title', { exact: true }).inputValue(), initial[1].title);
  await panel.getByRole('link', { name: 'Open full page' }).click();
  await page.waitForURL('**/issues/i2'); await page.getByRole('button', { name: 'Back to issues' }).click();
  await page.waitForURL('**/triage?issueId=i2');
  await page.getByRole('searchbox', { name: 'Search triage' }).fill('does not exist');
  await page.getByText('No matching intake.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await item('i1').click();
  await panel.getByRole('tab', { name: /Comments/ }).click();
  await panel.getByRole('textbox', { name: 'Write a comment' }).fill('Check the reporting currency.');
  await panel.getByRole('button', { name: 'Comment', exact: true }).click();
  await page.getByText('Check the reporting currency.', { exact: true }).waitFor();
  await panel.getByLabel('Issue title', { exact: true }).fill('Verified currency export intake');
  await panel.getByLabel('Issue title', { exact: true }).blur();
  await page.waitForFunction(() => document.querySelector('[data-triage-item="i1"]')?.textContent.includes('Verified currency export intake'));
  await panel.getByRole('button', { name: 'Accept', exact: true }).click();
  const accept = page.getByRole('dialog', { name: 'Accept ENG-1', exact: true });
  await accept.getByLabel('Route to team').selectOption('t2');
  await accept.getByLabel('Route assignee').locator('option[value="u2"]').waitFor({ state: 'attached' });
  assert.equal(await accept.getByLabel('Route assignee').locator('option[value="u1"]').count(), 0, 'Private destination requires explicit membership');
  await accept.getByLabel('Route assignee').selectOption('u2');
  await accept.getByRole('button', { name: 'Accept & route' }).click();
  await accept.waitFor({ state: 'hidden' });
  await page.waitForURL('**/triage?issueId=i2');
  assert.equal(issues[0].teamId, 't2'); assert.equal(issues[0].assigneeId, 'u2'); assert.equal(issues[0].status, 'todo');
  await panel.getByRole('button', { name: 'Decline', exact: true }).click();
  const decline = page.getByRole('dialog', { name: 'Decline ENG-2', exact: true });
  await decline.getByLabel('Decline reason').fill('Not actionable');
  failAction = true;
  await decline.getByRole('button', { name: 'Decline', exact: true }).click();
  await decline.getByText('Controlled decision conflict. Please retry.', { exact: true }).waitFor();
  assert.equal(await decline.getByLabel('Decline reason').inputValue(), 'Not actionable');
  failAction = false;
  let releaseAction;
  actionGate = new Promise(resolve => { releaseAction = resolve; });
  await decline.getByRole('button', { name: 'Decline', exact: true }).click();
  await decline.getByRole('button', { name: 'Saving…', exact: true }).waitFor();
  assert.equal(await decline.getByRole('button', { name: 'Cancel', exact: true }).isDisabled(), true);
  await page.keyboard.press('Escape'); assert.equal(await decline.isVisible(), true, 'Pending decision cannot be dismissed');
  releaseAction(); actionGate = null;
  await decline.waitFor({ state: 'hidden' });
  await page.waitForURL('**/triage?issueId=i3');
  await panel.getByRole('button', { name: 'Duplicate', exact: true }).click();
  const duplicate = page.getByRole('dialog', { name: 'Mark duplicate ENG-3', exact: true });
  const targets = duplicate.getByLabel('Duplicate target');
  assert.equal(await targets.locator('option[value="i3"],option[value="i4"],option[value="i6"]').count(), 0);
  await targets.selectOption('i5'); await duplicate.getByRole('button', { name: 'Mark duplicate', exact: true }).click();
  await duplicate.waitFor({ state: 'hidden' });
  assert.ok(issues[1].archivedAt && issues[2].archivedAt);
  assert.equal(requests.find(request => request.path === '/api/triage/i3/duplicate').body.relatedIssueId, 'i5');

  reset();
  for (const theme of ['dark', 'light']) for (const width of [1440, 1280, 1024, 900, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await open('/triage', theme); await item('i1').waitFor();
    if (!(await panel.isVisible())) await item('i1').click();
    await panel.getByLabel('Issue title', { exact: true }).waitFor(); await page.waitForTimeout(200);
    const layout = await panel.evaluate(element => {
      const title = element.querySelector('[aria-label="Issue title"]'), description = element.querySelector('#issue-description');
      const style = getComputedStyle(title), body = getComputedStyle(description);
      return { title: [style.fontSize, style.lineHeight, style.fontWeight, style.letterSpacing], description: [body.fontSize, body.lineHeight], clipped: title.scrollHeight > title.clientHeight + 2, overflow: document.documentElement.scrollWidth > innerWidth, props: element.querySelector('.issue-properties').getBoundingClientRect().x > title.getBoundingClientRect().right };
    });
    assert.deepEqual(layout.title, ['20px', '28px', '600', '-0.4px']); assert.deepEqual(layout.description, ['14px', '20px']);
    assert.equal(layout.clipped, false); assert.equal(layout.overflow, false); assert.equal(layout.props, width === 1440);
    assert.equal(await page.locator('button button,button input,button textarea').count(), 0);
    if ([1440, 390, 320].includes(width)) await page.screenshot({ path: `${out}/${theme}-${width}.png` });
    if (width === 1440) {
      const review = page.getByRole('region', { name: 'Triage review', exact: true });
      await review.evaluate(element => { element.scrollTop = 300; });
      assert(Math.abs((await panel.locator('header').boundingBox()).y - (await review.boundingBox()).y) < 1, 'Decision toolbar stays visible while reviewing');
    }
    if (width === 390) {
      await panel.getByRole('button', { name: 'Back to queue', exact: true }).click();
      await item('i1').waitFor(); assert.equal(await panel.isVisible(), false);
      await page.waitForFunction(() => document.querySelector('[data-triage-item="i1"]') === document.activeElement);
      assert.equal(await item('i1').evaluate(element => element === document.activeElement), true);
    }
  }
  for (const role of ['guest', 'client', 'member']) {
    reset(); user.role = role; if (role === 'member') mode = 'readOnly';
    await page.setViewportSize({ width: 1440, height: 900 }); await open();
    await panel.getByLabel('Issue title', { exact: true }).waitFor();
    await page.waitForTimeout(150);
    assert.equal(await panel.getByLabel('Issue title', { exact: true }).getAttribute('readonly'), '');
    for (const name of ['Accept', 'Decline', 'Duplicate']) assert.equal(await panel.getByRole('button', { name, exact: true }).isDisabled(), true);
    assert.equal(await panel.locator('#detail-priority').isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'New intake', exact: true }).isDisabled(), true);
  }
  reset(); await open('/triage?teamId=t2'); await item('i4').waitFor(); assert.equal(await item('i1').count(), 0);
  const before = requests.filter(request => request.path === '/api/issues/i1').length;
  await open('/triage?teamId=t2&issueId=i1'); await page.getByText('Intake unavailable', { exact: true }).waitFor();
  assert.equal(requests.filter(request => request.path === '/api/issues/i1').length, before, 'Out-of-scope IDs are not fetched');
  for (const state of ['slow', 'queueError', 'detailError', 'templateError']) {
    reset(); mode = state; await open();
    const expected = state === 'slow' ? page.getByRole('status', { name: 'Loading triage queue' }) : page.getByRole('alert').filter({ hasText: state === 'queueError' ? 'Triage queue could not be loaded.' : state === 'detailError' ? 'Could not load intake details. It may have been removed or you may not have access.' : 'Intake forms could not be loaded.' });
    await expected.waitFor();
    mode = '';
    if (state !== 'slow') await page.getByRole('button', { name: state === 'detailError' ? 'Retry details' : 'Retry', exact: true }).click();
    await panel.getByLabel('Issue title', { exact: true }).waitFor();
  }
  reset(); issues = []; await open(); await page.getByText('Nothing waiting for review', { exact: true }).waitFor();
  reset(); await open(); await page.getByRole('button', { name: 'New intake', exact: true }).click();
  const intake = page.getByRole('dialog', { name: 'New internal intake', exact: true });
  await intake.getByLabel('Intake title').fill('New internal report'); await intake.getByLabel('What should we know?').fill('Details for review');
  await intake.getByRole('button', { name: 'Submit to triage', exact: true }).click(); await item('new').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: triage master/detail, URL/history/reload/scope, shared issue edits/comments, accept/private routing/decline/duplicate/error/pending, permissions, intake/states, sticky toolbar and DESIGN.md checks across 14 desktop/tablet/mobile light/dark layouts.');
} finally { await browser.close(); }
