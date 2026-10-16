// Actual app router with controlled APIs; no live data, email or provider writes.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch();
const base = process.env.WEB_URL || 'http://localhost:5173';
const out = '/tmp/reka-settings';
await mkdir(out, { recursive: true });
const polishOut = '/tmp/reka-team-polish';
await mkdir(polishOut, { recursive: true });
let role = 'owner';
let githubUsername = 'dimaspratama';
let teamsFail = false, workflowFail = false, workflowSaveFail = false, workflowGate;
const teamDetails = { name: 'Engineering', description: 'Platform and product engineering.', isPrivate: false };
let workflow = ['triage', 'backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled', 'blocked'].map((key, position) => ({ key, name: key === 'todo' ? 'To do' : key.replaceAll('_', ' '), category: ({ triage: 'triage', backlog: 'backlog', todo: 'unstarted', done: 'completed', canceled: 'canceled' })[key] || 'started', color: '#6b7280', isActive: true, position }));
const people = [{ id: 'u1', name: 'Dimas Pratama', email: 'dimas@example.test', role: 'owner' }, { id: 'u2', name: 'Ayu Lestari', email: 'ayu@example.test', role: 'member' }];
let members = [{ teamId: 't1', userId: 'u1', role: 'lead', user: people[0] }];
let preferences = { mentions: true, comments: true, assignments: true, issueUpdates: true, projectUpdates: true, github: true, teamInvites: true };
const errors = [];
const requests = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
  await page.route('**/live.js*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    requests.push(`${request.method()} ${path}`);
    if (path === '/api/teams' && request.method() === 'POST') return route.fulfill({ status: 409, json: { message: 'Team key already exists' } });
    if (teamsFail && path === '/api/teams') return route.fulfill({ status: 503, json: { message: 'Controlled failure' } });
    if (path === '/api/notifications/preferences' && request.method() === 'PUT') preferences = request.postDataJSON();
    if (path === '/api/teams/t1/members' && request.method() === 'POST') {
      const payload = request.postDataJSON();
      members.push({ teamId: 't1', ...payload, user: people.find(person => person.id === payload.userId) });
      return route.fulfill({ json: members.at(-1) });
    }
    if (path === '/api/teams/t1/members/u2' && request.method() === 'PATCH') members.find(member => member.userId === 'u2').role = request.postDataJSON().role;
    if (path === '/api/teams/t1/members/u2' && request.method() === 'DELETE') members = members.filter(member => member.userId !== 'u2');
    if (path === '/api/teams/t1' && request.method() === 'PATCH') Object.assign(teamDetails, request.postDataJSON());
    if (path.endsWith('/workflow-states')) {
      if (workflowFail) return route.fulfill({ status: 503, json: { message: 'Controlled workflow failure' } });
      if (request.method() === 'PATCH') {
        if (workflowGate) await workflowGate;
        if (workflowSaveFail) return route.fulfill({ status: 409, json: { message: 'This state is in use. Keep it active.' } });
        workflow = request.postDataJSON().states;
      }
    }
    const team = { id: 't1', ...teamDetails, key: 'ENG', createdAt: '2026-10-01T00:00:00Z', currentMemberUserId: 'u1', canManage: ['owner', 'admin'].includes(role), canWrite: ['owner', 'admin'].includes(role), canDelete: ['owner', 'admin'].includes(role), members };
    const data = path === '/api/auth/me' ? { id: 'u1', name: 'Dimas Pratama', email: 'dimas@example.test', githubUsername, role }
      : path === '/api/workspace' ? { id: 'o1', name: 'REKA', role }
      : path === '/api/users' ? people
      : path === '/api/teams' ? [team, { ...team, id: 't2', name: 'Design', key: 'DES', isPrivate: true, members: members.map(member => ({ ...member, teamId: 't2' })) }] : path === '/api/teams/t1' ? team
      : path.endsWith('/workflow-states') ? workflow
      : path === '/api/projects' ? [{ id: 'p1', name: 'Booking platform', status: 'planned', health: 'on_track', teamId: 't1' }]
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
  for (const [label, heading, section] of [['Profile', 'Profile', 'profile'], ['Connected accounts', 'Connected accounts', 'accounts'], ['Workflows', 'Workflows', 'workflows'], ['Labels', 'Labels', 'labels'], ['Project settings', 'Project settings', 'projects'], ['GitHub', 'GitHub', 'github'], ['Workspace', 'Workspace', 'workspace'], ['Members', 'Workspace Users', 'members'], ['Teams', 'Teams', 'teams']]) {
    await nav.getByRole('link', { name: label, exact: true }).click();
    await page.waitForURL(`**/settings/${section}`);
    await page.getByRole('heading', { name: heading, exact: true, level: 1 }).waitFor();
    assert.equal(await nav.getByRole('link', { name: label, exact: true }).getAttribute('aria-current'), 'page');
    if (section === 'workflows') {
      await page.getByRole('button', { name: 'Configure workflow' }).first().click();
      await page.getByRole('dialog', { name: 'Team settings' }).waitFor();
      await page.getByLabel('todo state name').waitFor();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    if (section === 'labels') {
      await page.getByRole('button', { name: 'Manage labels', exact: true }).first().click();
      await page.getByRole('dialog', { name: 'Manage labels' }).waitFor();
      assert.equal(await page.getByLabel('Label team').inputValue(), 't1');
      await page.keyboard.press('Escape');
    }
  }
  const directory = page.getByRole('table', { name: 'Workspace teams' });
  assert.match(await directory.getByRole('row').nth(1).innerText(), /Design/);
  await page.getByRole('button', { name: 'Sort teams by name' }).click();
  assert.match(await directory.getByRole('row').nth(1).innerText(), /Engineering/);
  await page.getByRole('combobox', { name: 'Team visibility' }).click();
  await page.getByRole('option', { name: 'Private', exact: true }).click();
  assert.equal(await page.getByRole('link', { name: 'Manage team Engineering' }).count(), 0);
  await page.getByRole('link', { name: 'Manage team Design' }).waitFor();
  await page.getByRole('combobox', { name: 'Team visibility' }).click();
  await page.getByRole('option', { name: 'All visibility', exact: true }).click();
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  const createDialog = page.getByRole('dialog', { name: 'Create team', exact: true });
  await createDialog.getByLabel('Team name', { exact: true }).fill('Engineering');
  await createDialog.getByLabel('Identifier', { exact: true }).fill('1!');
  assert.equal(await createDialog.getByLabel('Identifier', { exact: true }).getAttribute('aria-invalid'), 'true');
  await createDialog.getByText('Use up to 10 letters or numbers, starting with a letter.', { exact: true }).waitFor();
  assert.equal(await createDialog.getByRole('button', { name: 'Create team', exact: true }).isDisabled(), true);
  await createDialog.getByLabel('Identifier', { exact: true }).fill('ENG');
  await createDialog.getByRole('button', { name: 'Create team', exact: true }).click();
  await createDialog.getByRole('alert').getByText('Team key already exists', { exact: true }).waitFor();
  assert.equal(await createDialog.getByLabel('Team name', { exact: true }).inputValue(), 'Engineering');
  await createDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Filter teams by name' }).fill('no matching team');
  await page.getByText('No matching teams. Try another name or visibility.', { exact: true }).waitFor();
  await page.getByRole('searchbox', { name: 'Filter teams by name' }).fill('Engineering');
  await page.getByRole('link', { name: 'Manage team Engineering' }).click();
  await page.waitForURL('**/settings/teams/t1');
  await page.getByRole('heading', { name: 'Engineering', exact: true, level: 1 }).waitFor();
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  const memberDialog = page.getByRole('dialog', { name: 'Add team member', exact: true });
  await memberDialog.getByRole('button', { name: 'Invite to workspace', exact: true }).click();
  await memberDialog.waitFor({ state: 'hidden' });
  const inviteDialog = page.getByRole('dialog', { name: 'Invite User', exact: true });
  await inviteDialog.getByLabel('Work email', { exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').count(), 1, 'Workspace invitation replaces, not stacks over, the add-member dialog');
  await inviteDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await memberDialog.getByLabel('Workspace member', { exact: true }).fill('ayu@example.test');
  await page.keyboard.press('Enter');
  await memberDialog.getByRole('button', { name: 'Add member', exact: true }).click();
  await memberDialog.waitFor({ state: 'hidden' });
  await page.getByRole('combobox', { name: 'Team role for Ayu Lestari' }).click();
  await page.getByRole('option', { name: 'Viewer', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Team role for Ayu Lestari"]')?.textContent?.includes('Viewer'));
  assert.equal(members.find(member => member.userId === 'u2').role, 'viewer');
  const deletesBefore = requests.filter(request => request.startsWith('DELETE')).length;
  await page.getByRole('button', { name: 'Member actions for Ayu Lestari' }).click();
  await page.getByRole('menuitem', { name: 'Remove member', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(requests.filter(request => request.startsWith('DELETE')).length, deletesBefore, 'Cancel must not remove a team member');
  await page.getByRole('button', { name: 'Member actions for Ayu Lestari' }).click();
  await page.getByRole('menuitem', { name: 'Remove member', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove member', exact: true }).click();
  await page.getByRole('combobox', { name: 'Team role for Ayu Lestari' }).waitFor({ state: 'hidden' });
  assert.equal(members.some(member => member.userId === 'u2'), false);
  await nav.waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Engineering', exact: true, level: 1 }).waitFor();
  await page.getByRole('link', { name: 'Open team', exact: true }).click();
  await page.waitForURL('**/teams/t1?tab=members');
  assert.equal(await page.getByRole('link', { name: 'Back to Teams', exact: true }).count(), 0, 'Team detail no longer renders a separate back-navigation row');
  await page.getByRole('link', { name: 'My issues', exact: true }).waitFor();
  const workspaceSidebar = page.locator('[data-slot="sidebar-content"]');
  assert.equal(await workspaceSidebar.getByRole('link', { name: 'Members', exact: true }).count(), 0, 'Members stays a page tab, not a sidebar menu');
  assert.equal(await workspaceSidebar.getByRole('link', { name: 'Overview', exact: true }).getAttribute('aria-current'), 'page');
  assert.equal(await page.getByRole('tab', { name: 'Members', exact: true }).getAttribute('aria-selected'), 'true');
  await page.getByRole('searchbox', { name: 'Search team members' }).fill('not a member');
  await page.getByRole('cell', { name: 'No members match your search.', exact: true }).waitFor();
  await page.getByRole('searchbox', { name: 'Search team members' }).fill('');
  const historyBeforeTab = await page.evaluate(() => history.length);
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await page.waitForURL('**/teams/t1');
  assert.equal(await page.evaluate(() => history.length), historyBeforeTab + 1, 'One tab click creates exactly one history entry');
  await page.goBack();
  await page.waitForURL('**/teams/t1?tab=members');
  assert.equal(await page.getByRole('tab', { name: 'Members', exact: true }).getAttribute('aria-selected'), 'true');
  await page.reload();
  await page.getByRole('combobox', { name: 'Team role for Dimas Pratama' }).waitFor();
  await page.getByRole('tab', { name: 'Overview', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/teams/t1');
  await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'Overview');
  await page.getByRole('tab', { name: 'Overview', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'tab' && document.activeElement.textContent?.trim() === 'Members');
  assert.equal(new URL(page.url()).search, '', 'Arrow focus alone does not navigate');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/teams/t1?tab=members');
  await page.goto(base + '/settings/teams/t1');
  await page.getByRole('link', { name: 'Back to teams', exact: true }).click();
  await page.waitForURL('**/settings/teams');
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
    await page.goto(base + '/settings/teams');
    await page.getByRole('link', { name: 'Manage team Engineering' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Teams directory stays within the viewport');
    await page.screenshot({ path: `${out}/${theme}-${width}-teams.png` });
    await page.getByRole('button', { name: 'Create team', exact: true }).click();
    await page.getByRole('dialog', { name: 'Create team', exact: true }).getByLabel('Team name', { exact: true }).fill('Engineering');
    assert.equal(await page.getByRole('dialog').getByLabel('Identifier', { exact: true }).inputValue(), 'ENG');
    assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Create team', exact: true }).isEnabled(), true);
    await page.screenshot({ path: `${out}/${theme}-${width}-create-team.png` });
    await page.getByRole('dialog', { name: 'Create team', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('link', { name: 'Manage team Engineering' }).click();
    await page.getByRole('combobox', { name: 'Team role for Dimas Pratama' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${out}/${theme}-${width}-team-members.png` });
    await page.getByRole('button', { name: 'Add member', exact: true }).click();
    await page.getByRole('dialog', { name: 'Add team member', exact: true }).getByLabel('Workspace member', { exact: true }).waitFor();
    await page.screenshot({ path: `${out}/${theme}-${width}-add-member.png` });
    await page.getByRole('dialog', { name: 'Add team member', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click();
    if (width === 1440) {
      await page.getByRole('link', { name: 'Back to workspace' }).click();
      await page.waitForURL('**/dashboard');
      await page.getByRole('link', { name: 'My issues', exact: true }).waitFor().catch(async error => {
        console.error('Workspace return state:', await page.locator('body').innerText());
        throw error;
      });
      assert.equal(await nav.count(), 0, 'Returning to the workspace restores its sidebar');
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/teams/t1?tab=settings');
  await page.getByLabel('Team name', { exact: true }).fill('Engineering operations');
  await page.getByLabel('Description', { exact: true }).fill('Owns platform delivery.');
  await page.getByRole('checkbox', { name: 'Private team', exact: true }).check();
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await page.getByRole('heading', { name: 'Engineering operations', exact: true }).waitFor();
  assert.equal(teamDetails.isPrivate, true);
  await page.reload();
  await page.getByLabel('Team name', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Team name', { exact: true }).inputValue(), 'Engineering operations');
  assert.equal(await page.getByRole('checkbox', { name: 'Private team', exact: true }).isChecked(), true);
  const beforeDelete = requests.filter(request => request === 'DELETE /api/teams/t1').length;
  await page.getByRole('button', { name: 'Delete team', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(requests.filter(request => request === 'DELETE /api/teams/t1').length, beforeDelete, 'Danger section still requires confirmation');
  await page.getByLabel('todo state name', { exact: true }).fill('Ready to start');
  workflowSaveFail = true;
  await page.getByRole('button', { name: 'Save workflow', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'This state is in use. Keep it active.' }).waitFor();
  assert.equal(await page.getByLabel('todo state name', { exact: true }).inputValue(), 'Ready to start');
  workflowSaveFail = false;
  let releaseWorkflow;
  workflowGate = new Promise(resolve => { releaseWorkflow = resolve; });
  await page.getByRole('button', { name: 'Save workflow', exact: true }).click();
  await page.getByRole('button', { name: 'Saving…', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Team name', { exact: true }).isDisabled(), true);
  assert.equal(await page.getByLabel('todo state name', { exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Add state', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Delete team', exact: true }).isDisabled(), true);
  releaseWorkflow(); workflowGate = null;
  await page.getByRole('button', { name: 'Save workflow', exact: true }).waitFor();
  await page.reload(); await page.getByLabel('todo state name', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('todo state name', { exact: true }).inputValue(), 'Ready to start');
  workflowFail = true; await page.reload();
  await page.getByRole('alert').filter({ hasText: 'Could not load workflow' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Add state', exact: true }).isDisabled(), true);
  workflowFail = false; await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByLabel('todo state name', { exact: true }).waitFor();
  Object.assign(teamDetails, { name: 'Engineering', description: 'Platform and product engineering.', isPrivate: false });
  for (const theme of ['dark', 'light']) for (const width of [1920, 1440, 900, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(theme => localStorage.setItem('reka-theme', theme), theme);
    for (const tab of ['members', 'settings']) {
      await page.goto(`${base}/teams/t1?tab=${tab}`);
      await page.getByRole('tabpanel', { name: tab === 'members' ? 'Members' : 'Settings', exact: true }).waitFor();
      await (tab === 'members' ? page.getByRole('combobox', { name: 'Team role for Dimas Pratama' }) : page.getByLabel('todo state name', { exact: true })).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.getByRole('link', { name: 'Back to Teams', exact: true }).count(), 0);
      const clipped = await page.evaluate(() => [...document.querySelectorAll('.team-detail-page input, .team-detail-page select, .team-detail-page button')].filter(element => { const rect = element.getBoundingClientRect(); return element.checkVisibility() && (rect.left < 0 || rect.right > innerWidth + 1); }).map(element => element.getAttribute('aria-label') || element.textContent));
      assert.deepEqual(clipped, [], `${theme} ${width} ${tab}: controls are not clipped`);
      if (tab === 'members') {
        await page.getByRole('button', { name: 'About team roles', exact: true }).click();
        await page.getByRole('dialog', { name: 'About team roles', exact: true }).getByText('Workspace permissions still apply.', { exact: true }).waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('dialog', { name: 'About team roles', exact: true }).waitFor({ state: 'hidden' });
        assert.equal(await page.getByRole('combobox', { name: 'Team role for Dimas Pratama' }).isDisabled(), true, 'Last writable lead guard stays intact');
      } else {
        const alignment = await page.getByRole('checkbox', { name: 'Private team', exact: true }).evaluate(element => { const label = document.querySelector('label[for="team-settings-private"]'); return { gap: label.getBoundingClientRect().left - element.getBoundingClientRect().right, formWidth: document.querySelector('.team-settings-form form').getBoundingClientRect().width, nestedScroll: [...document.querySelectorAll('[aria-label="Workflow states"], [aria-label="Workflow states"] *')].some(element => ['auto', 'scroll'].includes(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 2) }; });
        assert.ok(alignment.gap >= 6 && alignment.gap <= 12, 'Privacy checkbox remains next to its label, not spread across the form');
        assert.ok(alignment.formWidth <= 768);
        assert.equal(alignment.nestedScroll, false, 'Workflow uses page scroll instead of a cramped inner scroller');
        assert.equal(await page.locator('[data-workflow-state]').count(), 8);
        assert.equal(await page.getByRole('button', { name: 'Add state', exact: true }).isEnabled(), true);
      }
      await page.screenshot({ path: `${polishOut}/${theme}-${width}-${tab}.png`, fullPage: true });
      if (tab === 'settings' && [1440, 390].includes(width)) {
        await page.getByRole('button', { name: 'Save workflow', exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${polishOut}/${theme}-${width}-workflow.png`, fullPage: true });
      }
    }
  }
  role = 'guest'; githubUsername = null;
  await page.goto(base + '/settings/accounts');
  await page.getByText('No verified GitHub identity available', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
  assert.equal(await nav.getByText('Administrations', { exact: true }).count(), 0);
  for (const path of ['/settings/workspace', '/settings/teams', '/settings/teams/t1']) {
    await page.goto(base + path);
    await page.getByText('Only workspace owners and admins can manage these settings.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Add member', exact: true }).count(), 0);
  }
  await page.goto(base + '/settings/workflows');
  await page.getByRole('button', { name: 'Configure workflow' }).first().waitFor();
  assert.equal(await page.getByRole('button', { name: 'Configure workflow' }).first().isDisabled(), true);
  teamsFail = true;
  await page.goto(base + '/settings/workflows');
  await page.getByText('Could not load teams.', { exact: false }).waitFor();
  teamsFail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByRole('button', { name: 'Configure workflow' }).first().waitFor();
  role = 'admin';
  await page.goto(base + '/settings/teams/t1');
  await page.getByRole('combobox', { name: 'Team role for Dimas Pratama' }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: actual settings/team routes, member roles/search/help/last-lead controls, add/remove/cancel, compact team tabs/history, settings and workflow save/reload/error/pending/retry, privacy alignment, 20 team desktop/mobile light/dark renders, existing settings/dialog flows and read-only/admin access. Controlled APIs only.');
} finally { await browser.close(); }
