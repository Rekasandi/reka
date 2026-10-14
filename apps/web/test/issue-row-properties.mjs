// Run against `pnpm dev:web`: node apps/web/test/issue-row-properties.mjs
// Requires Playwright (or PLAYWRIGHT_MODULE pointing to its index.mjs).
// All API requests are mocked: this check does not modify real issues.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});

try {
  for (const view of ['grouped', 'flat', 'board']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copiedIssueId = text; } } });
    });
    page.on('pageerror', (error) => { errors.push(error.message); console.error(error.message); });
    const users = [
      { id: 'u1', name: 'Alice', email: 'alice@example.test', role: 'member' },
      { id: 'u2', name: 'Bob', email: 'bob@example.test', role: 'member' },
    ];
    const projects = [{ id: 'p1', name: 'Project Alpha' }, { id: 'p2', name: 'Project Beta' }];
    const teams = [{ id: 'team1', name: 'Engineering', key: 'ENG' }];
    const cycles = [
      { id: 'cy1', teamId: 'team1', name: 'October delivery', number: 1, status: 'active' },
      { id: 'cy2', teamId: 'team1', name: null, number: 2, status: 'upcoming' },
      { id: 'cy3', teamId: 'team2', name: 'Another team cycle', number: 3, status: 'active' },
    ];
    let cyclesFail = false;
    const base = {
      title: 'Inline editing check', type: 'task', status: 'todo', priority: 'medium',
      teamId: 'team1', projectId: null, cycleId: null, assigneeId: 'u1', createdAt: '2026-10-08T00:00:00Z',
    };
    let issues = [
      { ...base, id: 'i1', identifier: 'T-10', parentId: null },
      { ...base, id: 'i2', identifier: 'T-11', parentId: 'i1' },
      { ...base, id: 'i3', identifier: 'T-12', parentId: 'i2' },
    ];
    const updates = [];
    const creates = [];
    const deletes = [];
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (!path.startsWith('/api/')) return route.continue();
      let body;
      if (path === '/api/issues' && request.method() === 'GET') body = issues;
      else if (path === '/api/issues' && request.method() === 'POST') {
        const data = request.postDataJSON();
        creates.push(data);
        const created = { ...base, ...data, id: 'i-created', identifier: 'T-13', number: 13, createdAt: '2026-10-08T00:00:00Z' };
        issues = [...issues, created];
        body = created;
      }
      else if (path === '/api/projects') body = projects;
      else if (path === '/api/users') body = users;
      else if (path === '/api/labels') body = [];
      else if (path === '/api/teams') body = teams;
      else if (path.endsWith('/workflow-states')) body = [
        ['backlog', 'Backlog', 'backlog'], ['todo', 'Todo', 'unstarted'], ['in_progress', 'In Progress', 'started'],
        ['in_review', 'In Review', 'started'], ['ready_to_deploy', 'Ready to Deploy', 'started'], ['done', 'Done', 'completed'],
        ['canceled', 'Canceled', 'canceled'], ['blocked', 'Blocked', 'started'], ['triage', 'Triage', 'triage'],
      ].map(([key, name, category], position) => ({ teamId: 'team1', key, name, category, position, color: '#8f8f8f', isActive: true }));
      else if (path === '/api/cycles') {
        if (cyclesFail) return route.fulfill({ status: 500, json: { message: 'Unavailable' } });
        body = cycles;
      }
      else if (path.startsWith('/api/issues/') && request.method() === 'DELETE') {
        const id = path.split('/').at(-1);
        deletes.push(id);
        const removeIds = new Set([id]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const issue of issues) if (removeIds.has(issue.parentId) && !removeIds.has(issue.id)) { removeIds.add(issue.id); changed = true; }
        }
        issues = issues.filter(issue => !removeIds.has(issue.id));
        body = { success: true };
      }
      else if (path.startsWith('/api/issues/') && request.method() === 'PATCH') {
        const id = path.split('/').at(-1);
        const data = request.postDataJSON();
        updates.push({ id, data });
        issues = issues.map((issue) => issue.id === id ? { ...issue, ...data } : issue);
        body = issues.find((issue) => issue.id === id);
      } else throw new Error(`Unexpected API request: ${request.method()} ${path}`);
      await route.fulfill({ json: body });
    });
    await page.route('**/src/app/main.tsx*', async (route) => {
      const original = await (await route.fetch()).text();
      const version = original.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
      await route.fulfill({
      contentType: 'application/javascript',
      body: `
        import React from '/node_modules/.vite/deps/react.js${version}';
        import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${version}';
        import { QueryClient, QueryClientProvider } from '/node_modules/.vite/deps/@tanstack_react-query.js${version}';
        import { IssueGroupedListView } from '/src/features/issues/components/issue-grouped-list-view.tsx';
        import { IssueListView } from '/src/features/issues/components/issue-list-view.tsx';
        import { IssueKanbanBoard } from '/src/features/issues/components/issue-kanban-board.tsx';
        import { useIssues } from '/src/features/issues/hooks/use-issues.ts';
        import '/src/styles/globals.css';
        import { TooltipProvider } from '/@fs${fileURLToPath(new URL('../../../packages/ui/src/index.ts', import.meta.url))}';
        window.detailClicks = 0;
        function Fixture() {
          const { data: issues = [] } = useIssues();
          return React.createElement(${view === 'grouped' ? 'IssueGroupedListView' : view === 'board' ? 'IssueKanbanBoard' : 'IssueListView'}, {
            issues, onSelectIssue: () => { window.detailClicks++; }
          });
        }
        ReactDOM.createRoot(document.getElementById('root')).render(
          React.createElement(TooltipProvider, null, React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
            React.createElement(Fixture)))
        );
      `,
      });
    });
    await page.goto(process.env.WEB_URL || 'http://localhost:5173');
    const contextRow = identifier => page.locator('[data-slot=context-menu-trigger]').filter({ has: page.getByText(identifier, { exact: true }) });
    const openContext = async identifier => {
      await contextRow(identifier).click({ button: 'right' });
      await page.getByRole('menu', { name: `Actions for ${identifier}`, exact: true }).waitFor();
    };
    if (view !== 'board') {
      await openContext('T-10');
      assert.equal(await page.evaluate(() => window.detailClicks), 0, 'Right-click does not open the issue');
      assert.equal(await contextRow('T-10').locator('[role=checkbox]').getAttribute('aria-checked'), 'false');
      await page.screenshot({ path: `/tmp/reka-task-context-${view}-desktop.png` });
      await page.getByRole('menuitem', { name: 'Copy issue ID', exact: true }).click();
      await page.waitForFunction(() => window.copiedIssueId === 'T-10');
      await contextRow('T-10').focus();
      await page.keyboard.press('Shift+F10');
      await page.getByRole('menu', { name: 'Actions for T-10', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await openContext('T-10');
      await page.getByRole('menuitem', { name: 'Status', exact: true }).hover();
      const todo = page.getByRole('menuitemradio', { name: 'Todo', exact: true });
      await todo.waitFor();
      assert.equal(await todo.getAttribute('aria-checked'), 'true');
      await page.getByRole('menuitemradio', { name: 'In Progress', exact: true }).click();
      await page.getByRole('button', { name: 'Change status: In Progress', exact: true }).waitFor();
      assert(updates.some(({ id, data }) => id === 'i1' && data.status === 'in_progress'));
      await page.getByRole('button', { name: 'Change status: In Progress', exact: true }).focus();
      await page.keyboard.press('2');
      await page.getByRole('button', { name: 'Change status: Todo', exact: true }).waitFor();
      await openContext('T-10');
      await page.getByRole('menuitem', { name: 'Priority', exact: true }).hover();
      await page.getByRole('menuitemradio', { name: 'High', exact: true }).click();
      await page.getByRole('button', { name: 'Change priority: High', exact: true }).waitFor();
      assert(updates.some(({ id, data }) => id === 'i1' && data.priority === 'high'));
      await page.getByRole('button', { name: 'Change priority: High', exact: true }).focus();
      await page.keyboard.press('3');
      await page.getByRole('button', { name: 'Change priority: Medium', exact: true }).waitFor();
      await openContext('T-10');
      await page.getByRole('menuitem', { name: 'Issue type', exact: true }).hover();
      await page.getByRole('menuitemradio', { name: 'Bug', exact: true }).click();
      await page.getByRole('button', { name: 'Change issue type for T-10: Bug', exact: true }).waitFor();
      assert(updates.some(({ id, data }) => id === 'i1' && data.type === 'bug'));
      await page.getByRole('button', { name: 'Change issue type for T-10: Bug', exact: true }).focus();
      await page.keyboard.press('1');
      await page.getByRole('button', { name: 'Change issue type for T-10: Task', exact: true }).waitFor();
      await openContext('T-10');
      await page.getByRole('menuitem', { name: 'Delete issue', exact: true }).click();
      await page.getByRole('alertdialog').waitFor();
      assert.equal(deletes.length, 0, 'Context delete waits for confirmation');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
      await openContext('T-10');
      await page.getByRole('menuitem', { name: 'Open issue', exact: true }).click();
      assert.equal(await page.evaluate(() => window.detailClicks), 1, 'Only Open issue navigates to detail');
      await page.evaluate(() => { window.detailClicks = 0; });
    }
    const menuStyles = [];
    for (const [name, trigger] of [
      ['type', page.getByRole('button', { name: 'Change issue type for T-10: Task', exact: true })],
      ['status', page.getByRole('button', { name: 'Change status: Todo', exact: true }).first()],
      ['priority', page.getByRole('button', { name: 'Change priority: Medium', exact: true }).first()],
    ]) {
      await trigger.click();
      const search = page.getByRole('textbox', { name: `Search ${name === 'type' ? 'issue type' : name}`, exact: true });
      await search.waitFor();
      const beforeSearchUpdates = updates.length;
      await search.fill('2');
      assert.equal(updates.length, beforeSearchUpdates, `${name}: typing a number in search does not mutate the issue`);
      await search.fill(name === 'type' ? 'Bug' : name === 'status' ? 'Done' : 'Urgent');
      assert.equal(await page.getByRole('menuitemradio').count(), 1, `${name}: search filters options`);
      await search.fill('');
      const selected = page.getByRole('menuitemradio', { checked: true });
      const positions = await selected.evaluate(el => {
        const check = el.querySelector('[data-slot=dropdown-menu-radio-item-indicator]').getBoundingClientRect();
        const shortcut = el.querySelector('[data-slot=dropdown-menu-shortcut]').getBoundingClientRect();
        return { checkLeft: check.left, checkRight: check.right, shortcutLeft: shortcut.left };
      });
      assert(positions.checkLeft > 0 && positions.checkRight <= positions.shortcutLeft, `${name}: check is immediately before the shortcut`);
      assert(positions.shortcutLeft - positions.checkRight <= 12, `${name}: no large gap between check and number`);
      menuStyles.push(await selected.evaluate(el => {
        const style = getComputedStyle(el);
        const menu = el.closest('[data-slot=dropdown-menu-content]');
        const menuStyle = getComputedStyle(menu);
        return [menu.getBoundingClientRect().width, style.fontSize, style.paddingTop, style.paddingBottom, menuStyle.borderRadius, menuStyle.boxShadow];
      }));
      await page.screenshot({ path: `/tmp/reka-picker-${view}-${name}-desktop.png` });
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(menuStyles[0], menuStyles[1], 'Type and status menus use the same styles');
    assert.deepEqual(menuStyles[1], menuStyles[2], 'Status and priority menus use the same styles');
    const priorityTrigger = () => page.getByRole('button', { name: 'Change priority: Medium', exact: true }).first();
    await priorityTrigger().focus();
    await page.keyboard.press('2');
    await page.getByRole('button', { name: 'Change priority: High', exact: true }).first().waitFor();
    assert(updates.some(({ id, data }) => id === 'i1' && data.priority === 'high'));
    await page.getByRole('button', { name: 'Change priority: High', exact: true }).first().click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('3');
    await priorityTrigger().waitFor();
    assert(updates.some(({ id, data }) => id === 'i1' && data.priority === 'medium'));
    assert.equal(await page.evaluate(() => window.detailClicks), 0);
    if (view !== 'board') {
      const badges = [
        page.getByRole('button', { name: 'Change issue type for T-10: Task', exact: true }),
        page.getByRole('button', { name: 'Change project for T-10: No project', exact: true }),
        page.getByRole('button', { name: 'Change cycle for T-10: No cycle', exact: true }),
      ];
      assert.deepEqual(await Promise.all(badges.map(badge => badge.getAttribute('data-variant'))), ['warning', 'success', 'outline']);
      const colors = await Promise.all(badges.map(badge => badge.evaluate(el => getComputedStyle(el).backgroundColor)));
      assert.equal(new Set(colors).size, 3, 'Type, project and cycle badges must have distinct backgrounds');
    }
    if (view !== 'board') {
      const chevron = page.getByTitle(view === 'grouped' ? 'Expand subtasks' : 'Expand sub-tasks', { exact: true });
      assert.equal(await chevron.evaluate(el => el.previousElementSibling?.getAttribute('role')), 'checkbox', 'Checkbox must come immediately before the subtask chevron');
      const checkboxRight = await page.getByRole('checkbox', { name: 'Select issue T-10', exact: true }).evaluate(el => el.getBoundingClientRect().right);
      const chevronLeft = await chevron.evaluate(el => el.getBoundingClientRect().left);
      assert(checkboxRight <= chevronLeft, 'Checkbox must be positioned to the left of the chevron');
    }
    const trash = page.getByTitle(view === 'board' ? 'Delete Issue' : 'Delete issue', { exact: true }).first();
    await page.getByText('T-10', { exact: true }).hover();
    await page.waitForFunction(el => getComputedStyle(el).opacity === '1', await trash.elementHandle());
    assert.equal(await trash.evaluate(el => {
      const probe = document.createElement('span');
      probe.className = 'text-muted-foreground';
      document.body.append(probe);
      const matches = getComputedStyle(el).color === getComputedStyle(probe).color;
      probe.remove();
      return matches;
    }), true, 'Trash icon must use full-contrast muted text on row hover');

    if (view !== 'board') {
      let statusTrigger = page.getByRole('button', { name: 'Change status: Todo', exact: true });
      assert.equal(await statusTrigger.getAttribute('data-variant'), 'outline');
      await statusTrigger.focus();
      await page.keyboard.press('3');
      statusTrigger = page.getByRole('button', { name: 'Change status: In Progress', exact: true });
      await statusTrigger.waitFor();
      assert(updates.some(({ id, data }) => id === 'i1' && data.status === 'in_progress'), 'Focused status badge changes directly on number key');
      await statusTrigger.click();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('4');
      await page.getByRole('button', { name: 'Change status: In Review', exact: true }).waitFor();
      assert(updates.some(({ id, data }) => id === 'i1' && data.status === 'in_review'), 'Open status menu selects a numbered status without a second click');
    }

    const cycleTrigger = (label = 'No cycle', identifier = 'T-10') => page.getByRole('button', { name: `Change cycle for ${identifier}: ${label}`, exact: true });
    await cycleTrigger().click();
    const cycleSearch = page.getByRole('textbox', { name: 'Search cycles', exact: true });
    await cycleSearch.waitFor();
    assert.equal(await page.getByRole('menuitemradio', { name: /Another team cycle/ }).count(), 0);
    await cycleSearch.fill('missing cycle');
    await page.getByText('No cycles found.', { exact: true }).waitFor();
    await cycleSearch.fill('October');
    assert.equal(await page.getByRole('menuitemradio', { name: /Cycle 2/ }).count(), 0);
    await page.screenshot({ path: `/tmp/reka-cycle-search-${view}-desktop.png` });
    await page.getByRole('menuitemradio', { name: /October delivery/ }).click();
    await cycleTrigger('October delivery').waitFor();
    await cycleTrigger('October delivery').focus();
    await page.keyboard.press('Enter');
    await cycleSearch.fill('Cycle 2');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await cycleTrigger('Cycle 2').click();
    await page.getByRole('menuitemradio', { name: 'No cycle', exact: true }).click();
    await cycleTrigger().waitFor();
    assert(updates.some(({ data }) => data.cycleId === 'cy1'));
    assert(updates.some(({ data }) => data.cycleId === 'cy2'));
    assert(updates.some(({ data }) => data.cycleId === null));
    assert.equal(await page.evaluate(() => window.detailClicks), 0);

    if (view === 'board') {
      await cycleTrigger('No cycle', 'T-11').click();
      await page.getByRole('menuitemradio', { name: /October delivery/ }).click();
      await cycleTrigger('October delivery', 'T-11').waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      await cycleTrigger().click();
      await cycleSearch.fill('October');
      await page.getByRole('menuitemradio', { name: /October delivery/ }).click();
      await cycleTrigger('October delivery').waitFor();
      assert.equal(await page.evaluate(() => window.detailClicks), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: '/tmp/reka-issue-cycle-board-mobile.png' });
      assert.deepEqual(errors, []);
      await page.close();
      console.log('PASS: board cycles, team scope, keyboard selection, clear and mobile without detail navigation.');
      continue;
    }
    let type = page.getByRole('button', { name: 'Change issue type for T-10: Task', exact: true });
    await type.focus();
    await page.keyboard.press('2');
    type = page.getByRole('button', { name: 'Change issue type for T-10: Bug', exact: true });
    await type.waitFor();
    await type.click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('3');
    type = page.getByRole('button', { name: 'Change issue type for T-10: Feature', exact: true });
    await type.waitFor();
    await type.focus();
    await page.keyboard.press('2');
    await page.getByRole('button', { name: 'Change issue type for T-10: Bug', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Change issue type for T-10: Bug', exact: true }).getAttribute('data-variant'), 'destructive');

    await page.getByRole('button', { name: 'Change project for T-10: No project', exact: true }).click();
    const projectSearch = page.getByRole('textbox', { name: 'Search projects', exact: true });
    await projectSearch.fill('no matching project');
    await page.getByText('No projects found.', { exact: true }).waitFor();
    await projectSearch.fill('alpha');
    assert.equal(await page.getByRole('menuitemradio', { name: 'Project Beta', exact: true }).count(), 0);
    await page.screenshot({ path: `/tmp/reka-project-search-${view}-desktop.png` });
    await page.getByRole('menuitemradio', { name: 'Project Alpha', exact: true }).click();
    const project = page.getByRole('button', { name: 'Change project for T-10: Project Alpha', exact: true });
    await project.waitFor();
    await project.click();
    await projectSearch.fill('Beta');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Change project for T-10: Project Beta', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'No project', exact: true }).click();
    await page.getByRole('button', { name: 'Change project for T-10: No project', exact: true }).waitFor();

    await page.getByTitle('Assigned to Alice', { exact: true }).first().click();
    await page.getByRole('menuitem', { name: /Bob/ }).click();
    await page.getByTitle('Assigned to Bob', { exact: true }).click();
    await page.getByRole('menuitem', { name: 'Unassigned', exact: true }).click();
    await page.getByTitle('Assign member', { exact: true }).click();
    await page.getByRole('menuitem', { name: /Alice/ }).click();
    await page.getByTitle('Assigned to Alice', { exact: true }).first().waitFor();

    // Number shortcuts must not open the issue detail sheet.
    await page.getByTitle(view === 'grouped' ? 'Expand subtasks' : 'Expand sub-tasks', { exact: true }).click();
    await page.getByRole('button', { name: 'Change issue type for T-11: Task', exact: true }).click();
    await page.getByRole('menuitemradio', { name: /^Feature/ }).click();
    await page.getByRole('button', { name: 'Change issue type for T-11: Feature', exact: true }).waitFor();
    assert(updates.some(({ id, data }) => id === 'i2' && data.type === 'feature'));
    await cycleTrigger('No cycle', 'T-11').click();
    await page.getByRole('menuitemradio', { name: /October delivery/ }).click();
    await cycleTrigger('October delivery', 'T-11').waitFor();
    assert(updates.some(({ id, data }) => id === 'i2' && data.cycleId === 'cy1'));
    await openContext('T-11');
    await page.getByRole('menuitem', { name: 'Copy issue ID', exact: true }).click();
    await page.waitForFunction(() => window.copiedIssueId === 'T-11');
    assert(updates.some(({ data }) => data.assigneeId === null));
    assert(updates.some(({ data }) => data.projectId === null));
    assert.equal(await page.evaluate(() => window.detailClicks), 0);

    const checkbox = page.getByRole('checkbox', { name: 'Select issue T-10', exact: true });
    const waitForOpacity = async (value) => page.waitForFunction(
      ({ element, value }) => getComputedStyle(element).opacity === value,
      { element: await checkbox.elementHandle(), value },
    );
    await page.mouse.move(1000, 700);
    await waitForOpacity('0');
    await checkbox.hover();
    await waitForOpacity('1');
    await checkbox.click();
    await page.mouse.move(1000, 700);
    await waitForOpacity('1');
    assert.equal(await checkbox.getAttribute('aria-checked'), 'true');
    await checkbox.click();
    await page.mouse.move(1000, 700);
    await waitForOpacity('0');
    await page.keyboard.press('Tab');
    await checkbox.focus();
    await waitForOpacity('1');
    assert.equal(await page.evaluate(() => window.detailClicks), 0);
    await page.screenshot({ path: `/tmp/reka-issue-inline-${view}-desktop.png` });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Change project for T-10: No project', exact: true }).click();
    await projectSearch.fill('alpha');
    await page.screenshot({ path: `/tmp/reka-project-search-${view}-mobile.png` });
    await page.getByRole('menuitemradio', { name: 'Project Alpha', exact: true }).click();
    await page.getByRole('button', { name: 'Change project for T-10: Project Alpha', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.detailClicks), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await cycleTrigger().click();
    await cycleSearch.fill('october');
    await page.screenshot({ path: `/tmp/reka-cycle-search-${view}-mobile.png` });
    await page.getByRole('menuitemradio', { name: /October delivery/ }).click();
    await cycleTrigger('October delivery').waitFor();
    assert.equal(await cycleTrigger('October delivery').evaluate(el => el.getBoundingClientRect().right <= innerWidth), true);
    assert.equal(await page.evaluate(() => window.detailClicks), 0);
    await page.screenshot({ path: `/tmp/reka-issue-inline-${view}-mobile.png` });
    await openContext('T-10');
    await page.screenshot({ path: `/tmp/reka-task-context-${view}-mobile.png` });
    const mobileContextBounds = await page.getByRole('menu', { name: 'Actions for T-10', exact: true }).boundingBox();
    assert(mobileContextBounds.x >= -1 && mobileContextBounds.x + mobileContextBounds.width <= 391, `Context menu fits mobile viewport: ${JSON.stringify(mobileContextBounds)}`);
    await page.keyboard.press('Escape');
    cyclesFail = true;
    await page.reload();
    await cycleTrigger('Cycle unavailable').click();
    await page.getByRole('menuitem', { name: 'Failed to load cycles. Retry', exact: true }).waitFor();
    cyclesFail = false;
    await page.getByRole('menuitem', { name: 'Failed to load cycles. Retry', exact: true }).click();
    await page.getByRole('menuitemradio', { name: /Cycle 2/ }).waitFor();
    await page.keyboard.press('Escape');
    if (view === 'grouped') {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.getByTitle('Expand subtasks', { exact: true }).click();
      await page.getByRole('button', { name: 'Expand sub-issues for T-11', exact: true }).click();
      await page.getByRole('checkbox', { name: 'Select issue T-12', exact: true }).waitFor();
      await openContext('T-12');
      await page.getByRole('menuitem', { name: 'Copy issue ID', exact: true }).click();
      await page.waitForFunction(() => window.copiedIssueId === 'T-12');
      assert.equal(await page.locator('svg.lucide-corner-down-right').count(), 0, 'Sub-issues have no corner arrow icon');
      assert.equal(await page.getByText('T-12', { exact: true }).evaluate(el => !!el.closest('[class~="border-l"]')), false);
      const rowMetrics = id => {
        const selector = id === 'T-10' ? '.group.relative' : '[class*="group/sub"]';
        return page.getByText(id, { exact: true }).evaluate((el, rowSelector) => {
          const row = el.closest(rowSelector);
          return {
            left: row.getBoundingClientRect().left,
            width: row.getBoundingClientRect().width,
            checkbox: row.querySelector('[role=checkbox]').getBoundingClientRect().left,
          };
        }, selector);
      };
      const measurements = await Promise.all(['T-10', 'T-11', 'T-12'].map(rowMetrics));
      assert.equal(measurements[0].width, measurements[1].width, 'Sub-issue rows span the full list width');
      assert.equal(measurements[1].width, measurements[2].width, 'Nested sub-issue rows span the full list width');
      assert.equal(measurements[0].checkbox, measurements[1].checkbox, 'Issue and sub-issue checkboxes align at the left edge');
      assert.equal(measurements[1].checkbox, measurements[2].checkbox, 'Sub-issue checkboxes align at every nesting level');
      const rightPositions = async (id, selector) => page.getByText(id, { exact: true }).evaluate((el, rowSelector) => {
        const row = el.closest(rowSelector);
        const avatar = row.querySelector('[title^="Assigned to "]');
        const date = row.querySelector('span.w-16');
        return [avatar.getBoundingClientRect().left, date.getBoundingClientRect().left];
      }, selector);
      assert.deepEqual(await rightPositions('T-10', '.group.relative'), await rightPositions('T-11', '[class*="group/sub"]'), 'Parent and sub-issue avatars and dates align on the right');
      const idLeft = async id => page.getByText(id, { exact: true }).evaluate(el => el.getBoundingClientRect().left);
      assert(await idLeft('T-11') > await idLeft('T-10') && await idLeft('T-12') > await idLeft('T-11'), `Only nested issue content is indented: ${await idLeft('T-10')}, ${await idLeft('T-11')}, ${await idLeft('T-12')}`);
      const subRow = page.getByText('T-11', { exact: true }).locator('xpath=ancestor::div[contains(@class,"group/sub")]');
      const subPriority = subRow.locator('button[title="Change priority (P)"]');
      const subDate = subRow.locator('span.w-16');
      assert(await page.getByText('T-11', { exact: true }).evaluate(el => {
        const row = el.closest('[class*="group/sub"]');
        const priority = row.querySelector('button[title="Change priority (P)"]');
        const identifier = [...row.querySelectorAll('span.font-mono')].find(span => span.textContent === 'T-11');
        return !!(priority.compareDocumentPosition(identifier) & Node.DOCUMENT_POSITION_FOLLOWING);
      }), 'Sub-issue priority appears before its identifier');
      assert.equal(await subDate.evaluate(el => el.getBoundingClientRect().width), 64, 'Sub-issue date reserves the same width as parent issue date');
      await page.getByRole('checkbox', { name: 'Select issue T-12', exact: true }).click();
      assert.equal(await page.getByRole('checkbox', { name: 'Select issue T-12', exact: true }).getAttribute('aria-checked'), 'true');
      await page.getByRole('checkbox', { name: 'Select issue T-12', exact: true }).click();
      const deleteChild = page.getByRole('button', { name: 'Delete sub-issue T-11', exact: true });
      await deleteChild.waitFor();
      await page.getByText('T-11', { exact: true }).hover();
      await page.waitForFunction(el => getComputedStyle(el).opacity === '1', await deleteChild.elementHandle());
      await openContext('T-11');
      await page.getByRole('menuitem', { name: 'Delete issue', exact: true }).click();
      await page.getByRole('alertdialog').waitFor();
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await page.getByText('T-11', { exact: true }).waitFor({ state: 'detached' });
      assert(deletes.includes('i2') && !issues.some(issue => issue.id === 'i2'));
    }
    await openContext('T-10');
    await page.getByRole('menuitem', { name: 'Add sub-issue', exact: true }).click();
    const subIssueDialog = page.getByRole('dialog', { name: 'New Sub-issue', exact: true });
    await subIssueDialog.waitFor();
    await subIssueDialog.getByLabel('Title', { exact: true }).fill('Context menu child issue');
    await subIssueDialog.getByRole('button', { name: 'Create Sub-issue', exact: true }).click();
    await subIssueDialog.waitFor({ state: 'hidden' });
    assert.equal(creates.at(-1).parentId, 'i1', 'Context creation links the new issue to the selected parent');
    assert.equal(creates.at(-1).teamId, 'team1');
    assert.equal(creates.at(-1).title, 'Context menu child issue');
    assert.deepEqual(errors, []);
    console.log(`PASS: ${view} list, inline updates, checkbox hover/selected/keyboard visibility, subtasks and mobile; no detail navigation.`);
    await page.close();
  }
} finally {
  await browser.close();
}
