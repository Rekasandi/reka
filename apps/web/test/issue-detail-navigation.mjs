// UI/navigation contract only: controlled fixtures, no live data or provider calls.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const base = process.env.WEB_URL || 'http://localhost:5173';
const out = '/tmp/reka-issue-detail';
await mkdir(out, { recursive: true });
const user = { id: 'u1', name: 'Dimas Pratama', email: 'dimas@example.test', role: 'owner' };
const team = { id: 't1', name: 'Engineering', key: 'ENG', canWrite: true, canManage: true, currentMemberRole: 'lead', members: [] };
const label = { id: 'label1', name: 'Customer experience', color: '#6b7280', teamId: team.id };
const issue = { id: 'i1', identifier: 'ENG-42', title: 'Keep booking confirmation clear when a payment is still being verified', description: 'A guest should understand whether their booking is confirmed before leaving checkout.\n\nAcceptance criteria\nShow the payment state without hiding the booking reference. Keep the confirmation email consistent with this state.', status: 'in_review', priority: 'high', type: 'task', teamId: 't1', assigneeId: user.id, reporterId: user.id, labels: [label], createdAt: '2026-10-14T08:00:00Z', updatedAt: '2026-10-14T08:00:00Z' };
const subtask = { ...issue, id: 'i2', identifier: 'ENG-43', parentId: issue.id, title: 'Align the pending payment message', priority: 'medium' };
let comments = [{ id: 'c1', issueId: issue.id, authorId: user.id, authorName: user.name, body: 'The booking reference should stay visible even while we wait for payment confirmation.', canEdit: true, createdAt: '2026-10-14T08:00:00Z' }];
let favorites = [];
const errors = [];
const requests = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
  await page.route('**/live.js*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    requests.push(`${request.method()} ${path}`);
    if (path === '/api/issues/missing') return route.fulfill({ status: 404, json: { message: 'Issue not found' } });
    if (path === '/api/issues/slow') { await new Promise(resolve => setTimeout(resolve, 750)); return route.fulfill({ json: { ...issue, id: 'slow' } }); }
    if (request.method() === 'PATCH' && path === '/api/issues/i1') { Object.assign(issue, request.postDataJSON()); return route.fulfill({ json: issue }); }
    if (request.method() === 'POST' && path === '/api/comments/by-issue/i1') { const comment = { ...comments[0], id: 'c2', body: request.postDataJSON().body }; comments.push(comment); return route.fulfill({ json: comment }); }
    if (path.startsWith('/api/favorites') && request.method() === 'POST') { favorites = [{ resourceType: 'issue', resourceId: 'i1', name: issue.title, href: '/issues/i1' }]; return route.fulfill({ json: favorites[0] }); }
    const data = path === '/api/auth/me' ? user
      : path === '/api/workspace' ? { name: 'REKA', role: 'owner' }
      : path === '/api/teams' ? [team] : path === '/api/teams/t1' ? team
      : path.endsWith('/workflow-states') ? []
      : path === '/api/users' ? [user]
      : path === '/api/labels' ? [label]
      : path === '/api/issues' ? [issue, subtask] : path === '/api/issues/i1' ? issue : path === '/api/issues/i2' ? subtask
      : path.endsWith('/subtasks') ? [subtask]
      : path === '/api/comments/by-issue/i1' ? comments
      : path === '/api/activities/by-issue/i1' ? [{ id: 'a1', actorName: user.name, type: 'issue.created', createdAt: issue.createdAt }]
      : path.endsWith('/subscription') ? { subscribed: false } : path.endsWith('/recurrence') ? null
      : path === '/api/favorites' ? favorites
      : path === '/api/notifications' ? [{ id: 'n1', type: 'assignment', title: 'Assigned to ENG-42', body: issue.title, read: false, metadata: { issueId: issue.id, issueIdentifier: issue.identifier }, createdAt: issue.createdAt }]
      : path.endsWith('/unread-count') ? { count: 1 } : [];
    return route.fulfill({ json: data });
  });
  const open = async (path, theme = 'light') => {
    await page.addInitScript(theme => localStorage.setItem('reka-theme', theme), theme);
    await page.goto(base + path);
  };
  const chipAppearance = locator => locator.evaluate(el => {
    const style = getComputedStyle(el);
    return { background: style.backgroundColor, border: style.borderColor, color: style.color, radius: style.borderRadius, height: style.height };
  });
  await open('/issues');
  const listChip = page.locator('[data-testid="issue-row-i1"]').getByRole('button', { name: 'Change status: In Review', exact: true });
  await listChip.waitFor();
  const listChipAppearance = await chipAppearance(listChip);
  try { await page.getByRole('button', { name: `Open issue ${issue.identifier}: ${issue.title}`, exact: true }).click({ timeout: 15000 }); }
  catch (error) { console.error('Body:', await page.locator('body').innerText(), 'Requests:', requests); throw error; }
  const sheet = page.getByRole('dialog', { name: 'Issue ENG-42', exact: true });
  await sheet.waitFor();
  await page.waitForTimeout(250);
  assert.deepEqual(await chipAppearance(sheet.locator('#detail-status')), listChipAppearance, 'Sheet status preserves the same chip appearance as the issue list');
  await page.screenshot({ path: out + '/sheet-desktop.png' });
  await sheet.getByRole('link', { name: 'Open full page' }).click();
  await page.waitForURL('**/issues/i1');
  await page.locator('[data-issue-detail="page"]').waitFor();
  await page.getByRole('heading', { name: issue.title, exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog', { name: 'Issue ENG-42' }).count(), 0, 'full page is not a modal');
  await page.getByLabel('Issue estimate').fill('5'); await page.getByLabel('Issue estimate').blur();
  await page.waitForFunction(() => document.querySelector('#issue-estimate')?.value === '5');
  await page.getByRole('textbox', { name: 'Write a comment' }).fill('Ready for the next review.');
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await page.getByText('Ready for the next review.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Add issue to favorites' }).click();
  await page.getByRole('button', { name: 'Remove issue from favorites' }).waitFor();
  await page.reload();
  await page.getByLabel('Issue estimate').waitFor();
  assert.equal(await page.getByLabel('Issue estimate').inputValue(), '5');
  await page.getByRole('button', { name: 'Issue actions' }).click();
  await page.getByRole('menuitem', { name: 'Copy issue link' }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Relations (0)', exact: true }).click();
  await page.getByRole('combobox', { name: 'Relation type' }).click();
  await page.getByRole('option', { name: 'Related to', exact: true }).click();
  await page.getByRole('combobox', { name: 'Related issue' }).click();
  await page.getByRole('option', { name: /ENG-43/ }).click();
  await page.getByRole('button', { name: 'Recurrence', exact: true }).click();
  await page.getByRole('combobox', { name: 'Recurrence cadence' }).click();
  await page.getByRole('option', { name: 'Month(s)', exact: true }).click();
  await page.getByRole('tab', { name: /Activity/ }).click();
  await page.getByText('issue created', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Back to issues' }).click();
  await page.waitForURL('**/issues');
  assert.equal(await page.getByRole('dialog', { name: 'Issue ENG-42' }).count(), 0);

  await open('/inbox');
  await page.getByRole('button', { name: /Open Issue/ }).click();
  await page.waitForURL('**/issues/i1');
  await page.getByRole('button', { name: 'Back to issues' }).click();
  await page.waitForURL('**/inbox');

  for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await open('/issues/i1', theme);
    await page.getByRole('heading', { name: issue.title, exact: true }).waitFor();
    await page.evaluate(theme => document.documentElement.className = theme, theme);
    const title = page.getByRole('textbox', { name: 'Issue title', exact: true });
    assert.ok(await title.evaluate(el => parseFloat(getComputedStyle(el).fontSize)) >= 20, 'editable title preserves hierarchy');
    assert.equal(await title.evaluate(el => el.scrollHeight > el.clientHeight + 2), false, 'long title is not clipped');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('button button, button input, button textarea').count(), 0, 'no nested controls');
    for (const property of ['status', 'priority', 'type', 'project', 'cycle', 'assignee']) {
      const chip = await chipAppearance(page.locator(`#detail-${property}`));
      assert.notEqual(chip.background, 'rgba(0, 0, 0, 0)', `${theme} ${width}: ${property} chip has a background`);
      assert.notEqual(chip.border, 'rgba(0, 0, 0, 0)', `${theme} ${width}: ${property} chip has a visible border`);
      assert.equal(chip.height, listChipAppearance.height, `${property} remains a compact chip`);
    }
    await page.screenshot({ path: `${out}/page-${theme}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await open('/issues');
  await page.getByRole('button', { name: `Open issue ${issue.identifier}: ${issue.title}`, exact: true }).click();
  await page.waitForURL('**/issues/i1');
  await page.locator('[data-issue-detail="page"]').waitFor();
  assert.equal(await page.getByRole('dialog', { name: 'Issue ENG-42' }).count(), 0, 'mobile list opens full page');
  await page.goBack();
  await page.waitForURL('**/issues');
  await page.goForward();
  await page.waitForURL('**/issues/i1');
  await page.getByRole('button', { name: 'Back to issues' }).click();
  await page.waitForURL('**/issues');
  await open('/issues/slow');
  await page.getByRole('status', { name: 'Loading issue' }).waitFor();
  await page.getByLabel('Issue estimate').waitFor();
  await open('/issues/missing');
  await page.getByText('Issue unavailable', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Try again' }).waitFor();
  assert.deepEqual(errors, []);
  assert.ok(requests.includes('PATCH /api/issues/i1'));
  console.log('PASS: actual router, desktop sheet → full page, Inbox → full page, direct/reload/back/mobile, shared mutations, loading/error and light/dark layouts. Mock API only.');
} finally { await browser.close(); }
