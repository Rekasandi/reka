// Run with Vite on WEB_URL (default localhost:5173). Test-only app mount and
// session fixtures; all /api responses come from actual Nest + isolated Postgres.
// No OAuth, Redis, live database, GitHub writes or API response mocks.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../../api/test/support/isolated-api.cjs', import.meta.url));
const { createPersistentPostgres } = require('./persistent-postgres.cjs');
const { createIsolatedApi } = require('./isolated-api.cjs');

const { organizations, organizationMembers, users, teams, teamMembers, sessions, issues, issueHistory, issueRecurrences, issueTemplates, issueRelations, activities, projects, cycles, savedViews, userFavorites, milestones, projectDependencies, projectUpdates, projectUpdateSubscriptions, documents } = require('@reka/database');
const { and, eq, asc } = require('drizzle-orm');
const modules = ['issues', 'users', 'teams', 'projects', 'cycles', 'labels', 'activities', 'comments', 'attachments', 'github', 'triage', 'search', 'views', 'documents', 'initiatives'].map(name => {
  const exports = require(`../../dist/${name}/${name}.module`);
  return Object.values(exports)[0];
});
modules.push(require('../../dist/common/redis/redis.module').RedisModule);
const { RedisService } = require('../../dist/common/redis/redis.service');
const ui = fileURLToPath(new URL('../../../packages/ui/src/index.ts', import.meta.url));
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { chromium } = playwright.chromium ? playwright : playwright.default;
const postgres = await createPersistentPostgres();
let api, browser;

try {
  const [org] = await postgres.db.insert(organizations).values({ name: 'E2E company', slug: 'e2e' }).returning();
  const [owner, member] = await postgres.db.insert(users).values([
    { name: 'E2E Owner', email: 'owner@example.test', role: 'owner' },
    { name: 'Browser Member', email: 'member@example.test', role: 'member' },
  ]).returning();
  await postgres.db.insert(organizationMembers).values([
    { organizationId: org.id, userId: owner.id, role: 'owner' },
    { organizationId: org.id, userId: member.id, role: 'member' },
  ]);
  const [team] = await postgres.db.insert(teams).values({ organizationId: org.id, name: 'Engineering', key: 'ENG' }).returning();
  await postgres.db.insert(teamMembers).values([
    { teamId: team.id, userId: owner.id, role: 'lead' },
    { teamId: team.id, userId: member.id, role: 'member' },
  ]);
  const [project, prerequisiteProject] = await postgres.db.insert(projects).values([
    { organizationId: org.id, teamId: team.id, name: 'Browser project', slug: 'browser-project', ownerId: owner.id },
    { organizationId: org.id, teamId: team.id, name: 'Browser prerequisite', slug: 'browser-prerequisite', ownerId: owner.id },
  ]).returning();
  const [cycle] = await postgres.db.insert(cycles).values({ teamId: team.id, number: 1, name: 'Browser cycle', startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-14T00:00:00Z') }).returning();
  const token = randomUUID();
  await postgres.db.insert(sessions).values({ id: token, userId: owner.id, expiresAt: new Date(Date.now() + 86400000) });
  api = await createIsolatedApi(postgres, modules, [[RedisService, { getClient: () => { throw new Error('Redis intentionally unavailable in isolated browser test'); } }]]);
  browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  page.on('response', async response => {
    if (new URL(response.url()).pathname.startsWith('/api/') && response.status() >= 400) console.error('API failure:', response.status(), response.url(), (await response.text().catch(() => '')).slice(0, 500));
  });
  const seenApi = [];
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    seenApi.push(`${request.method()} ${path}`);
    return route.continue({
      url: `${api.url}${path}${new URL(request.url()).search}`,
      headers: { ...request.headers(), authorization: `Bearer ${token}` },
    });
  });
  let createdDocumentId;
  await page.route('**/src/app/main.tsx*', async route => {
    const original = await (await route.fetch()).text();
    const version = original.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
    await route.fulfill({ contentType: 'application/javascript', body: `
      import React from '/node_modules/.vite/deps/react.js${version}';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${version}';
      import { QueryClient, QueryClientProvider } from '/node_modules/.vite/deps/@tanstack_react-query.js${version}';
      import { MemoryRouter, Routes, Route, useLocation } from '/node_modules/.vite/deps/react-router-dom.js${version}';
      import { TooltipProvider } from '/@fs${ui}';
      import { ThemeProvider } from '/src/components/theme/theme-provider.tsx';
      import { IssuesPage } from '/src/features/issues/components/issues-page.tsx';
      import { IssueDetailPage } from '/src/features/issues/components/issue-detail-page.tsx';
      import { TriagePage } from '/src/features/issues/components/triage-page.tsx';
      import { ProjectDetailPage } from '/src/features/projects/components/project-detail-page.tsx';
      import { DocumentsPage } from '/src/features/projects/components/documents-page.tsx';
      import { DocumentDetailPage } from '/src/features/projects/components/document-detail-page.tsx';
      import { FavoritesPage } from '/src/features/views/components/favorites-page.tsx';
      import { InitiativesPage } from '/src/features/initiatives/components/initiatives-page.tsx';
      import { InitiativeDetailPage } from '/src/features/initiatives/components/initiative-detail-page.tsx';
      import { RoadmapPage } from '/src/features/initiatives/components/roadmap-page.tsx';
      import { CommandPalette } from '/src/components/command-palette/command-palette.tsx';
      import { useKeyboardShortcuts } from '/src/hooks/use-keyboard-shortcuts.ts';
      import { TeamSettingsDialog } from '/src/features/teams/components/team-settings-dialog.tsx';
      import { useAuthStore } from '/src/stores/auth.store.ts';
      import '/src/styles/globals.css';
      useAuthStore.setState({ user: ${JSON.stringify(owner)}, isAuthenticated: true });
      function RouteProbe() { const location = useLocation(); return React.createElement('output', { 'data-testid': 'route-location', className: 'sr-only' }, location.pathname + location.search); }
      function Harness() {
        useKeyboardShortcuts();
        const [settingsOpen, setSettingsOpen] = React.useState(false);
        window.__rekaOpenTeamSettings = () => setSettingsOpen(true);
        return React.createElement(React.Fragment, null,
          React.createElement(RouteProbe),
          React.createElement(Routes, null,
            React.createElement(Route, { path: '/issues', element: React.createElement(IssuesPage) }),
            React.createElement(Route, { path: '/issues/:id', element: React.createElement(IssueDetailPage) }),
            React.createElement(Route, { path: '/projects/:id', element: React.createElement(ProjectDetailPage) }),
            React.createElement(Route, { path: '/documents', element: React.createElement(DocumentsPage) }),
            React.createElement(Route, { path: '/documents/:id', element: React.createElement(DocumentDetailPage) }),
            React.createElement(Route, { path: '/favorites', element: React.createElement(FavoritesPage) }),
            React.createElement(Route, { path: '/initiatives', element: React.createElement(InitiativesPage) }),
            React.createElement(Route, { path: '/initiatives/:id', element: React.createElement(InitiativeDetailPage) }),
            React.createElement(Route, { path: '/roadmap', element: React.createElement(RoadmapPage) }),
            React.createElement(Route, { path: '/triage', element: React.createElement(TriagePage) })),
          React.createElement(CommandPalette),
          React.createElement(TeamSettingsDialog, { team: ${JSON.stringify(team)}, open: settingsOpen, onOpenChange: setSettingsOpen }));
      }
      ReactDOM.createRoot(document.getElementById('root')).render(
        React.createElement(TooltipProvider, null,
          React.createElement(ThemeProvider, { defaultTheme: new URLSearchParams(location.search).get('theme') || 'dark', storageKey: 'foundation-e2e' },
            React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
              React.createElement(MemoryRouter, { initialEntries: [new URLSearchParams(location.search).get('page') === 'triage' ? '/triage' : new URLSearchParams(location.search).get('page') === 'favorites' ? '/favorites' : new URLSearchParams(location.search).get('page') === 'project' ? '/projects/${project.id}' : new URLSearchParams(location.search).get('page') === 'documents' ? '/documents' : new URLSearchParams(location.search).get('page') === 'document' ? '/documents/' + new URLSearchParams(location.search).get('documentId') : new URLSearchParams(location.search).get('page') === 'initiatives' ? '/initiatives' : new URLSearchParams(location.search).get('page') === 'initiative' ? '/initiatives/' + new URLSearchParams(location.search).get('initiativeId') : new URLSearchParams(location.search).get('page') === 'roadmap' ? '/roadmap' : '/issues'] },
                React.createElement('main', { className: 'p-6' }, React.createElement(Harness)))))));
    ` });
  });
  const url = process.env.WEB_URL || 'http://localhost:5173';
  await page.goto(url);
  await page.evaluate(() => window.__rekaOpenTeamSettings());
  const settings = page.getByRole('dialog', { name: 'Team settings' });
  await settings.getByRole('button', { name: 'Add state' }).click();
  await settings.getByLabel('new_state state name').fill('Quality check');
  const workflowSave = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === `/api/teams/${team.id}/workflow-states`);
  await settings.getByRole('button', { name: 'Save workflow' }).click();
  assert.equal((await workflowSave).status(), 200);
  await settings.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'New Issue', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New Issue', exact: true });
  await dialog.getByLabel('Title', { exact: true }).fill('Real API browser foundation');
  await dialog.getByLabel('Description', { exact: true }).fill('Browser-authored acceptance criteria.');
  await dialog.getByLabel('Estimate', { exact: true }).fill('0');
  await dialog.getByLabel('Due date', { exact: true }).fill('2026-11-18');
  await dialog.getByRole('button', { name: 'Change project: No project' }).click();
  await page.getByRole('menuitemradio', { name: 'Browser project' }).click();
  await dialog.getByRole('button', { name: 'Change cycle: No cycle' }).click();
  await page.getByRole('menuitemradio', { name: /Browser cycle/ }).click();
  await dialog.getByRole('button', { name: 'Change priority: Medium' }).click();
  await page.getByRole('menuitemradio', { name: 'High' }).click();
  await dialog.getByRole('button', { name: 'Change issue type: Task' }).click();
  await page.getByRole('menuitemradio', { name: /Bug/ }).click();
  await dialog.getByLabel('Assignee', { exact: true }).click();
  await page.getByRole('option', { name: 'Unassigned' }).click();
  await dialog.getByRole('button', { name: 'Change status: Todo' }).click();
  await page.getByRole('menuitemradio', { name: /Quality check/ }).click();
  await dialog.getByRole('button', { name: 'Issue labels' }).click();
  await page.getByLabel('New label name').fill('Browser verified');
  await page.getByRole('button', { name: 'Create label' }).click();
  await page.getByText('Browser verified', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: 'Create Issue', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByText('Real API browser foundation', { exact: true }).waitFor();
  const [browserIssue] = await postgres.db.select().from(issues).where(eq(issues.title, 'Real API browser foundation'));
  await page.getByRole('button', { name: 'Manage labels', exact: true }).click();
  const labelsDialog = page.getByRole('dialog', { name: 'Manage labels' }); await labelsDialog.waitFor();
  await labelsDialog.getByLabel('Browser verified label name').fill('Browser verified renamed');
  const renameLabel = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname.startsWith('/api/labels/'));
  await labelsDialog.getByRole('button', { name: 'Save Browser verified', exact: true }).click(); assert.equal((await renameLabel).status(), 200);
  const labelRow = (await postgres.db.select().from(require('@reka/database').labels)).find(item => item.name === 'Browser verified renamed'); assert.ok(labelRow);
  assert.equal((await postgres.db.select().from(require('@reka/database').issueLabels).where(eq(require('@reka/database').issueLabels.issueId, browserIssue.id))).length, 1);
  await labelsDialog.getByRole('button', { name: 'Delete Browser verified renamed', exact: true }).click();
  const deleteConfirm = page.getByRole('alertdialog', { name: 'Delete “Browser verified renamed”?' });
  const deleteLabel = page.waitForResponse(response => response.request().method() === 'DELETE' && new URL(response.url()).pathname === `/api/labels/${labelRow.id}`);
  await deleteConfirm.getByRole('button', { name: 'Delete', exact: true }).click(); assert.equal((await deleteLabel).status(), 200);
  await labelsDialog.getByRole('button', { name: 'Close', exact: true }).first().click();
  assert.equal((await postgres.db.select().from(require('@reka/database').issueLabels).where(eq(require('@reka/database').issueLabels.issueId, browserIssue.id))).length, 0);
  assert.equal((await postgres.db.select().from(issues).where(eq(issues.id, browserIssue.id))).length, 1);
  await page.getByRole('button', { name: 'Board view' }).click();
  const kanbanIssue = page.getByTestId(`kanban-issue-${browserIssue.id}`);
  await kanbanIssue.waitFor({ timeout: 5000 });
  const boardStatusUpdate = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === `/api/issues/${browserIssue.id}`);
  const boardReorder = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/issues/${browserIssue.id}/move-to-top`);
  await page.evaluate(issueId => {
    const card = document.querySelector(`[data-testid="kanban-issue-${issueId}"]`);
    const column = document.querySelector('[data-testid="kanban-column-in_progress"]');
    if (!card || !column) throw new Error('Kanban drag targets missing');
    const dataTransfer = new DataTransfer();
    card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    column.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
    column.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
  }, browserIssue.id);
  assert.equal((await boardStatusUpdate).status(), 200); assert.equal((await boardReorder).status(), 201);
  const movedIssue = (await postgres.db.select().from(issues).where(eq(issues.id, browserIssue.id)))[0];
  assert.equal(movedIssue.status, 'in_progress'); assert.ok(movedIssue.sortOrder > 0);
  const restoreBoardStatus = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === `/api/issues/${browserIssue.id}`);
  await page.getByTestId(`kanban-issue-${browserIssue.id}`).getByRole('button', { name: 'Change status: In Progress' }).click();
  await page.getByRole('menuitemradio', { name: 'Quality check' }).click(); assert.equal((await restoreBoardStatus).status(), 200);
  await page.getByRole('button', { name: 'Grouped by status' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  assert.equal(await page.getByText('Real API browser foundation', { exact: true }).count(), 0, 'custom unstarted status is excluded from Done');
  await page.getByRole('button', { name: 'Active', exact: true }).click();
  await page.getByText('Real API browser foundation', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  let rows = await postgres.db.select().from(issues);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Real API browser foundation');
  assert.equal(rows[0].reporterId, owner.id);
  assert.equal(rows[0].description, 'Browser-authored acceptance criteria.');
  assert.equal(rows[0].type, 'bug');
  assert.equal(rows[0].priority, 'high');
  assert.equal(rows[0].assigneeId, null);
  assert.equal(rows[0].estimate, 0);
  assert.equal(rows[0].projectId, project.id);
  assert.equal(rows[0].cycleId, cycle.id);
  assert.equal(rows[0].status, 'new_state');
  assert.equal((await postgres.db.select().from(require('@reka/database').teamWorkflowStates).where(eq(require('@reka/database').teamWorkflowStates.key, 'new_state')))[0].name, 'Quality check');
  assert.equal(new Date(rows[0].dueDate).toISOString().slice(0, 10), '2026-11-18');
  const createdLabels = await postgres.db.select().from(require('@reka/database').issueLabels).where(eq(require('@reka/database').issueLabels.issueId, rows[0].id));
  assert.equal(createdLabels.length, 0, 'deleting a label removes its assignment while preserving the issue');
  const persisted = rows[0];
  await postgres.reopen();
  await page.reload();
  await page.getByText('Real API browser foundation', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'New Issue', exact: true }).click();
  const secondDialog = page.getByRole('dialog', { name: 'New Issue', exact: true });
  await secondDialog.getByLabel('Title', { exact: true }).fill('Second browser issue');
  await secondDialog.getByRole('button', { name: 'Create Issue', exact: true }).click();
  await secondDialog.waitFor({ state: 'hidden' });
  await page.getByText('Second browser issue', { exact: true }).waitFor();
  const currentRows = await postgres.db.select().from(issues);
  const secondIssue = currentRows.find((row) => row.title === 'Second browser issue');
  assert.ok(secondIssue);
  await page.getByText('Second browser issue', { exact: true }).click();
  const recurrenceDetail = page.getByRole('dialog', { name: `Issue ${secondIssue.identifier}` });
  await recurrenceDetail.getByRole('button', { name: 'Recurrence', exact: true }).click();
  const recurrenceSection = recurrenceDetail.locator('section[aria-label="Issue recurrence"]');
  await recurrenceSection.getByLabel('Recurrence interval').fill('2');
  await recurrenceSection.getByRole('combobox', { name: 'Recurrence cadence' }).click();
  await page.getByRole('option', { name: 'Month(s)', exact: true }).click();
  await recurrenceSection.getByLabel('Recurrence timezone').fill('America/Los_Angeles');
  await recurrenceSection.getByLabel('Next occurrence').fill('2099-03-01T09:00');
  await recurrenceSection.getByLabel('Due date offset').fill('3');
  const recurrenceSave = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/issues/${secondIssue.id}/recurrence`);
  await recurrenceSection.getByRole('button', { name: 'Save recurrence', exact: true }).click();
  assert.equal((await recurrenceSave).status(), 201);
  const [savedRecurrence] = await postgres.db.select().from(issueRecurrences).where(eq(issueRecurrences.sourceIssueId, secondIssue.id));
  assert.equal(savedRecurrence.intervalCount, 2);
  assert.equal(savedRecurrence.timezone, 'America/Los_Angeles');
  assert.equal(savedRecurrence.template.dueDateOffsetDays, 3);
  const recurrenceStop = page.waitForResponse(response => response.request().method() === 'DELETE' && new URL(response.url()).pathname === `/api/issues/${secondIssue.id}/recurrence`);
  await recurrenceSection.getByRole('button', { name: 'Stop recurring issue' }).click();
  assert.equal((await recurrenceStop).status(), 200);
  assert.equal((await postgres.db.select().from(issueRecurrences).where(eq(issueRecurrences.id, savedRecurrence.id)))[0].enabled, false);
  await page.keyboard.press('Escape');
  await recurrenceDetail.waitFor({ state: 'hidden' });
  await page.getByText('Real API browser foundation', { exact: true }).click();
  const detail = page.getByRole('dialog', { name: `Issue ${persisted.identifier}` });
  await detail.waitFor();
  await detail.getByRole('button', { name: 'Relations (0)', exact: true }).click();
  await detail.getByRole('combobox', { name: 'Related issue' }).click();
  await page.getByRole('option', { name: new RegExp(secondIssue.identifier) }).click();
  await detail.getByRole('button', { name: 'Add relation' }).click();
  await detail.locator('section[aria-label="Issue relations"]').getByText(secondIssue.identifier, { exact: true }).waitFor();
  assert.equal((await postgres.db.select().from(require('@reka/database').issueRelations).where(eq(require('@reka/database').issueRelations.issueId, persisted.id))).length, 1);
  await detail.getByRole('button', { name: 'Add sub-task', exact: true }).click();
  await detail.getByPlaceholder('Sub-task title...').fill('Browser verified sub-issue');
  await detail.getByRole('button', { name: 'Add', exact: true }).click();
  await detail.getByText('Browser verified sub-issue', { exact: true }).waitFor();
  const subIssue = (await postgres.db.select().from(issues)).find((row) => row.title === 'Browser verified sub-issue');
  assert.ok(subIssue?.parentId === persisted.id, 'sub-issue persists with its parent relation');
  await detail.getByRole('button', { name: `Complete ${subIssue.identifier}`, exact: true }).click();
  await detail.getByRole('button', { name: `Reopen ${subIssue.identifier}`, exact: true }).waitFor();
  assert.equal((await postgres.db.select().from(issues).where(eq(issues.id, subIssue.id)))[0].status, 'done', 'sub-task completion refreshes in the shared detail');
  const estimateUpdate = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === `/api/issues/${persisted.id}`);
  await detail.getByLabel('Issue estimate').fill('3');
  await detail.getByLabel('Issue estimate').blur();
  assert.equal((await estimateUpdate).status(), 200);
  const dueDateUpdate = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === `/api/issues/${persisted.id}`);
  await detail.getByLabel('Issue due date').fill('2026-12-01');
  await detail.getByLabel('Issue due date').blur();
  assert.equal((await dueDateUpdate).status(), 200);
  await detail.getByRole('button', { name: 'Issue actions' }).click();
  await page.getByRole('menuitem', { name: 'Archive issue', exact: true }).click();
  await detail.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Archived', exact: true }).click();
  await page.getByText('Real API browser foundation', { exact: true }).waitFor();
  await page.getByText('Real API browser foundation', { exact: true }).click();
  await page.getByRole('button', { name: 'Issue actions' }).click();
  await page.getByRole('menuitem', { name: 'Restore issue', exact: true }).click();
  await page.getByRole('dialog', { name: `Issue ${persisted.identifier}` }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByText('Real API browser foundation', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'List view' }).click();
  await page.getByRole('checkbox', { name: `Select issue ${persisted.identifier}` }).click();
  await page.getByRole('checkbox', { name: `Select issue ${secondIssue.identifier}` }).click();
  await page.getByRole('button', { name: 'Status...' }).click();
  const refreshedIssues = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/issues' && response.status() === 200);
  const bulkUpdate = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === '/api/issues/bulk');
  await page.getByRole('menuitem', { name: 'Done', exact: true }).click();
  assert.equal((await bulkUpdate).status(), 200);
  await refreshedIssues;
  assert.equal((await postgres.db.select().from(issues).where(eq(issues.id, persisted.id)))[0].status, 'done');
  const refreshedAfterMove = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/issues' && response.status() === 200);
  const moveToTop = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/issues/${secondIssue.id}/move-to-top`);
  await page.getByText('Second browser issue', { exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Move to top' }).click();
  assert.equal((await moveToTop).status(), 201);
  await refreshedAfterMove;
  assert((await postgres.db.select().from(issues).where(eq(issues.id, secondIssue.id)))[0].sortOrder > (await postgres.db.select().from(issues).where(eq(issues.id, persisted.id)))[0].sortOrder);
  await postgres.reopen();
  const finalIssue = (await postgres.db.select().from(issues).where(eq(issues.id, persisted.id)))[0];
  assert.equal(finalIssue.estimate, 3);
  assert.equal(new Date(finalIssue.dueDate).toISOString().slice(0, 10), '2026-12-01');
  assert.equal(finalIssue.archivedAt, null);
  assert.equal((await postgres.db.select().from(require('@reka/database').issueRelations).where(eq(require('@reka/database').issueRelations.issueId, persisted.id))).length, 1);
  rows = await postgres.db.select().from(issues).where(eq(issues.id, persisted.id));
  assert.equal(rows.length, 1);
  const events = await postgres.db.select().from(issueHistory).where(eq(issueHistory.issueId, persisted.id)).orderBy(asc(issueHistory.id));
  assert.equal(events[0].event, 'created');
  assert.equal(events[0].afterState.title, persisted.title);
  assert(seenApi.includes('POST /api/issues'));

  await page.getByLabel('Group issues by').selectOption('none');
  await page.getByLabel('Sort issues by').selectOption('priority');
  const orderedRows = await page.locator('[data-testid^="issue-row-"]').evaluateAll(elements => elements.map(element => element.getAttribute('data-testid')));
  assert.ok(orderedRows.indexOf(`issue-row-${persisted.id}`) < orderedRows.indexOf(`issue-row-${secondIssue.id}`), 'priority sorting places high before medium');
  await page.getByRole('button', { name: 'Show filters', exact: true }).click();
  const filterPanel = page.locator('#issue-filters-panel');
  await filterPanel.getByRole('tab', { name: 'Priority', exact: true }).click();
  await filterPanel.getByRole('button', { name: /High/ }).click();
  await page.getByTestId(`issue-row-${persisted.id}`).waitFor();
  await page.getByTestId(`issue-row-${secondIssue.id}`).waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  const saveViewDialog = page.getByRole('dialog', { name: 'Save issue view' });
  await saveViewDialog.getByLabel('View name').fill('Saved browser view');
  const saveViewResponse = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/views');
  await saveViewDialog.getByRole('button', { name: 'Save view', exact: true }).click();
  assert.equal((await saveViewResponse).status(), 201);
  const [savedView] = await postgres.db.select().from(savedViews).where(eq(savedViews.name, 'Saved browser view'));
  assert.equal(savedView.config.groupBy, 'none');
  assert.equal(savedView.config.sortBy, 'priority');
  assert.deepEqual(savedView.config.filters.priorities, ['high']);
  await page.getByLabel('Saved issue view').selectOption('');
  await page.getByLabel('Group issues by').selectOption('status');
  await page.getByLabel('Sort issues by').selectOption('manual');
  await page.getByLabel('Saved issue view').selectOption(savedView.id);
  await page.waitForFunction(() => document.querySelector('[aria-label="Group issues by"]').value === 'none' && document.querySelector('[aria-label="Sort issues by"]').value === 'priority');
  await page.getByLabel('Add view to favorites').click();
  await page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/favorites');
  assert.equal((await postgres.db.select().from(userFavorites).where(eq(userFavorites.resourceId, savedView.id))).length, 1);

  await page.keyboard.press('Control+k');
  const commandInput = page.getByPlaceholder('Search issues, projects, and documents…');
  await commandInput.fill(persisted.identifier);
  await page.getByRole('option', { name: new RegExp(persisted.identifier) }).click();
  const searchedIssue = page.locator('[data-issue-detail="page"]');
  await searchedIssue.waitFor();
  await searchedIssue.getByLabel('Add issue to favorites').click();
  await page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/favorites');
  assert.equal((await postgres.db.select().from(userFavorites).where(eq(userFavorites.resourceId, persisted.id))).length, 1);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Search issues, projects, and documents…').fill('Browser project');
  await page.getByRole('option', { name: 'Browser project' }).click();
  await page.getByRole('heading', { name: 'Browser project', exact: true }).waitFor();
  await page.getByLabel('Project status').click();
  const statusSave = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === `/api/projects/${project.id}`);
  await page.getByRole('option', { name: 'Paused' }).click();
  assert.equal((await statusSave).status(), 200);
  await page.getByLabel('Project health').click();
  const healthSave = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === `/api/projects/${project.id}`);
  await page.getByRole('option', { name: 'At Risk' }).click();
  assert.equal((await healthSave).status(), 200);
  await page.getByText('Set start date', { exact: true }).click();
  const startDay = await page.evaluate(() => new Date(2026, 9, 20).toLocaleDateString());
  const startDateSave = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === `/api/projects/${project.id}`);
  await page.locator(`[data-day="${startDay}"]`).click();
  assert.equal((await startDateSave).status(), 200);
  await page.getByText('Set target date', { exact: true }).click();
  const targetDay = await page.evaluate(() => new Date(2026, 9, 29).toLocaleDateString());
  const targetDateSave = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === `/api/projects/${project.id}`);
  await page.locator(`[data-day="${targetDay}"]`).click();
  assert.equal((await targetDateSave).status(), 200);
  const savedProjectDates = (await postgres.db.select().from(projects).where(eq(projects.id, project.id)))[0];
  assert.equal(new Date(savedProjectDates.startDate).toLocaleDateString(), startDay);
  assert.equal(new Date(savedProjectDates.targetDate).toLocaleDateString(), targetDay);
  await page.getByRole('button', { name: 'Manage members' }).click();
  const projectMembersDialog = page.getByRole('dialog', { name: 'Project members' });
  await projectMembersDialog.getByLabel('Select user to invite').click();
  await page.getByRole('option', { name: /Browser Member/ }).click();
  const addProjectMember = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/projects/${project.id}/members`);
  await projectMembersDialog.getByRole('button', { name: 'Add', exact: true }).click();
  assert.equal((await addProjectMember).status(), 201);
  const projectMembersTable = require('@reka/database').projectMembers;
  assert.equal((await postgres.db.select().from(projectMembersTable).where(eq(projectMembersTable.projectId, project.id))).some(row => row.userId === member.id), true);
  const removeProjectMember = page.waitForResponse(response => response.request().method() === 'DELETE' && new URL(response.url()).pathname === `/api/projects/${project.id}/members/${member.id}`);
  await projectMembersDialog.getByRole('button', { name: 'Remove Browser Member from project' }).click();
  assert.equal((await removeProjectMember).status(), 200);
  await projectMembersDialog.getByRole('button', { name: 'Close' }).first().click();
  await page.getByLabel('Project lead').click();
  const leadSave = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === `/api/projects/${project.id}`);
  await page.getByRole('option', { name: 'Browser Member' }).click();
  assert.equal((await leadSave).status(), 200);
  assert.equal((await postgres.db.select().from(projects).where(eq(projects.id, project.id)))[0].ownerId, member.id);
  const projectFavorite = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/favorites');
  await page.getByLabel('Add project to favorites').click();
  await projectFavorite;
  assert.equal((await postgres.db.select().from(userFavorites).where(eq(userFavorites.resourceId, project.id))).length, 1);

  await page.getByRole('tab', { name: 'Milestones' }).click();
  await page.getByRole('button', { name: 'New milestone' }).click();
  const milestoneDialog = page.getByRole('dialog', { name: 'New milestone' });
  await milestoneDialog.getByLabel('Milestone name').fill('Browser delivery milestone');
  await milestoneDialog.getByLabel('Milestone description').fill('Track browser-verified delivery.');
  await milestoneDialog.getByLabel('Target date').fill('2026-11-15');
  await milestoneDialog.getByLabel('Target date').fill('2026-12-15');
  const milestoneCreate = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/projects/${project.id}/milestones`);
  await milestoneDialog.getByRole('button', { name: 'Create milestone' }).click();
  const milestoneResponse = await milestoneCreate;
  assert.equal(milestoneResponse.status(), 201);
  const [browserMilestone] = await postgres.db.select().from(milestones).where(eq(milestones.name, 'Browser delivery milestone'));
  assert.ok(browserMilestone);
  const assignIssue = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/projects/${project.id}/milestones/${browserMilestone.id}/issues/${persisted.id}`);
  await page.getByLabel('Assign issue to Browser delivery milestone').click();
  await page.getByRole('option', { name: new RegExp(persisted.identifier) }).click();
  assert.equal((await assignIssue).status(), 201);
  assert.equal((await postgres.db.select().from(issues).where(eq(issues.id, persisted.id)))[0].milestoneId, browserMilestone.id);
  await page.getByRole('tab', { name: 'Dependencies' }).click();
  await page.getByLabel('Choose prerequisite project').click();
  await page.getByRole('option', { name: 'Browser prerequisite' }).click();
  const dependencySave = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/projects/${project.id}/dependencies`);
  await page.getByRole('button', { name: 'Add dependency' }).click();
  assert.equal((await dependencySave).status(), 201);
  assert.equal((await postgres.db.select().from(projectDependencies).where(eq(projectDependencies.projectId, project.id))).length, 1);
  await page.getByRole('tab', { name: 'Updates' }).click();
  const subscribeToUpdates = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/projects/${project.id}/update-subscription`);
  await page.getByRole('button', { name: 'Subscribe to updates' }).click();
  assert.equal((await subscribeToUpdates).status(), 201);
  assert.equal((await postgres.db.select().from(projectUpdateSubscriptions).where(and(eq(projectUpdateSubscriptions.projectId, project.id), eq(projectUpdateSubscriptions.userId, owner.id)))).length, 1);
  await page.getByLabel('Health update').selectOption('at_risk');
  await page.getByLabel('Project update', { exact: true }).fill('Browser verified risk and mitigation update.');
  const updateSave = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/projects/${project.id}/updates`);
  await page.getByRole('button', { name: 'Post update' }).click();
  assert.equal((await updateSave).status(), 201);
  assert.equal((await postgres.db.select().from(projectUpdates).where(eq(projectUpdates.projectId, project.id))).length, 1);
  await page.getByRole('tab', { name: 'Documents' }).click();
  await page.getByRole('button', { name: 'New document' }).click();
  const documentDialog = page.getByRole('dialog', { name: 'New document' });
  await documentDialog.getByLabel('Document title').fill('Browser project delivery notes');
  await documentDialog.getByLabel('Document content').fill('Browser searchable project document contents.');
  const documentCreate = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/documents');
  await documentDialog.getByRole('button', { name: 'Create document' }).click();
  const documentResponse = await documentCreate;
  assert.equal(documentResponse.status(), 201);
  createdDocumentId = (await documentResponse.json()).id;
  await page.getByRole('link', { name: /Browser project delivery notes/ }).waitFor();
  const documentFavorite = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/favorites');
  await page.getByRole('button', { name: 'Add Browser project delivery notes to favorites' }).click();
  await documentFavorite;
  assert.equal((await postgres.db.select().from(userFavorites).where(and(eq(userFavorites.resourceId, createdDocumentId), eq(userFavorites.resourceType, 'document')))).length, 1);
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Search issues, projects, and documents…').fill('Browser project delivery notes');
  await page.getByRole('option', { name: 'Browser project delivery notes' }).click();
  await page.getByLabel('Document content in Markdown').waitFor();
  await page.getByLabel('Document title').fill('Updated browser project notes');
  await page.getByLabel('Document content in Markdown').fill('Updated searchable content after browser edit.');
  const documentUpdate = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === `/api/documents/${createdDocumentId}`);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  assert.equal((await documentUpdate).status(), 200);
  assert.equal((await postgres.db.select().from(documents).where(eq(documents.id, createdDocumentId)))[0].title, 'Updated browser project notes');
  const archiveDocument = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/documents/${createdDocumentId}/archive`);
  await page.getByRole('button', { name: 'Archive document' }).click();
  assert.equal((await archiveDocument).status(), 201);
  const restoreDocument = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/documents/${createdDocumentId}/restore`);
  await page.getByRole('button', { name: 'Restore' }).click();
  assert.equal((await restoreDocument).status(), 201);
  assert.equal((await postgres.db.select().from(documents).where(eq(documents.id, createdDocumentId)))[0].archivedAt, null);
  await page.waitForLoadState('networkidle');
  await postgres.reopen();
  await page.goto(`${url}?page=document&documentId=${createdDocumentId}`);
  await page.getByLabel('Document content in Markdown').waitFor();
  assert.equal(await page.getByLabel('Document title').inputValue(), 'Updated browser project notes');
  assert.equal((await postgres.db.select().from(milestones).where(eq(milestones.id, browserMilestone.id))).length, 1);
  assert.equal((await postgres.db.select().from(projectDependencies).where(eq(projectDependencies.projectId, project.id))).length, 1);
  assert.equal((await postgres.db.select().from(projectUpdates).where(eq(projectUpdates.projectId, project.id))).length, 1);
  assert.equal((await postgres.db.select().from(projectUpdateSubscriptions).where(and(eq(projectUpdateSubscriptions.projectId, project.id), eq(projectUpdateSubscriptions.userId, owner.id)))).length, 1);

  // Initiative create/edit, cross-project grouping, real progress and roadmap render via the same authenticated API.
  await page.goto(`${url}?page=initiatives`);
  await page.getByRole('heading', { name: 'Initiatives', exact: true }).waitFor();
  await page.getByRole('button', { name: 'New initiative', exact: true }).click();
  const initiativeDialog = page.getByRole('dialog', { name: 'New initiative' });
  await initiativeDialog.getByLabel('Initiative name').fill('Browser roadmap initiative');
  await initiativeDialog.getByLabel('Initiative description').fill('Initiative created by the authenticated browser workflow.');
  await initiativeDialog.getByLabel('Initiative status').selectOption('in_progress');
  await initiativeDialog.getByLabel('Initiative health').selectOption('at_risk');
  await initiativeDialog.getByLabel('Initiative start date').fill('2026-10-01');
  await initiativeDialog.getByLabel('Initiative target date').fill('2026-12-31');
  const createInitiativeResponse = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/initiatives');
  await initiativeDialog.getByRole('button', { name: 'Create initiative' }).click();
  const initiativeCreateResponse = await createInitiativeResponse;
  assert.equal(initiativeCreateResponse.status(), 201);
  const browserInitiative = await initiativeCreateResponse.json();
  const browserInitiativeDb = (await postgres.db.select().from(require('@reka/database').initiatives).where(eq(require('@reka/database').initiatives.id, browserInitiative.id)))[0];
  assert.equal(browserInitiativeDb.status, 'in_progress');
  assert.equal(new Date(browserInitiativeDb.startDate).toISOString().slice(0, 10), '2026-10-01');
  await page.getByRole('link', { name: /Browser roadmap initiative/ }).click();
  await page.getByRole('heading', { name: 'Browser roadmap initiative', exact: true }).waitFor();
  await page.getByLabel('Project to add').selectOption(project.id);
  const addInitiativeProject = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/initiatives/${browserInitiative.id}/projects`);
  await page.getByRole('button', { name: 'Add project', exact: true }).click();
  assert.equal((await addInitiativeProject).status(), 201);
  await page.getByLabel('Project to add').selectOption(prerequisiteProject.id);
  const addPrerequisiteToInitiative = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/initiatives/${browserInitiative.id}/projects`);
  await page.getByRole('button', { name: 'Add project', exact: true }).click();
  assert.equal((await addPrerequisiteToInitiative).status(), 201);
  await page.getByRole('link', { name: 'Browser project', exact: true }).waitFor();
  await page.getByLabel('Edit initiative target date').fill('2027-01-15');
  const updateInitiativeResponse = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === `/api/initiatives/${browserInitiative.id}`);
  await page.getByRole('button', { name: 'Save changes' }).click();
  assert.equal((await updateInitiativeResponse).status(), 200);
  const initiativeProjectsDb = await postgres.db.select().from(require('@reka/database').initiativeProjects).where(eq(require('@reka/database').initiativeProjects.initiativeId, browserInitiative.id));
  assert.equal(initiativeProjectsDb.length, 2);
  const persistedInitiative = (await postgres.db.select().from(require('@reka/database').initiatives).where(eq(require('@reka/database').initiatives.id, browserInitiative.id)))[0];
  assert.equal(new Date(persistedInitiative.targetDate).toISOString().slice(0, 10), '2027-01-15');
  await page.getByRole('link', { name: 'Open roadmap' }).click();
  await page.getByRole('heading', { name: 'Roadmap', exact: true }).waitFor();
  await page.getByRole('img', { name: /initiative Browser roadmap initiative/ }).waitFor();
  await page.getByRole('img', { name: /project Browser project/ }).waitFor();
  await page.getByRole('img', { name: /milestone Browser project · Browser delivery milestone/ }).waitFor();
  await page.getByRole('heading', { name: 'Dependencies' }).waitFor();
  for (const theme of ['dark', 'light']) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${url}?page=roadmap&theme=${theme}`);
    await page.getByRole('heading', { name: 'Roadmap', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/reka-roadmap-${theme}-${width}.png` });
    await page.goto(`${url}?page=initiatives&theme=${theme}`);
    await page.getByRole('heading', { name: 'Initiatives', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/reka-initiatives-${theme}-${width}.png` });
  }

  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.keyboard.press('g'); await page.keyboard.press('r');
  await page.getByRole('heading', { name: 'Roadmap', exact: true }).waitFor();
  await page.keyboard.press('g'); await page.keyboard.press('n');
  await page.getByRole('heading', { name: 'Initiatives', exact: true }).waitFor();
  await page.keyboard.press('g'); await page.keyboard.press('f');
  await page.getByRole('heading', { name: 'Favorites', exact: true }).waitFor();
  for (const theme of ['dark', 'light']) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${url}?page=favorites&theme=${theme}`);
    await page.getByRole('heading', { name: 'Favorites', exact: true }).waitFor();
    await page.getByRole('link', { name: /Saved browser view/ }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/reka-favorites-${theme}-${width}.png` });
  }
  await page.getByRole('link', { name: /Saved browser view/ }).click();
  await page.waitForFunction((id) => document.querySelector('[data-testid="route-location"]')?.textContent === `/issues?viewId=${id}`, savedView.id);
  await page.waitForFunction(() => document.querySelector('[aria-label="Group issues by"]').value === 'none' && document.querySelector('[aria-label="Sort issues by"]').value === 'priority');
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Search issues, projects, and documents…').waitFor();
  await page.keyboard.press('Escape');
  const localSearch = page.getByPlaceholder('Search issues...');
  await localSearch.focus(); await page.keyboard.press('c');
  assert.equal(await localSearch.inputValue(), 'c', 'shortcuts do not hijack text entry');
  assert.equal(await page.getByRole('dialog', { name: 'New Issue', exact: true }).count(), 0);
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.keyboard.press('c');
  await page.getByRole('dialog', { name: 'New Issue', exact: true }).waitFor();
  await page.keyboard.press('Escape');

  await page.goto(`${url}?page=triage`);
  await page.getByRole('heading', { name: 'Triage', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  const templatesDialog = page.getByRole('dialog', { name: 'Issue intake templates' });
  await templatesDialog.getByLabel('Template name').fill('Browser intake form');
  const createTemplate = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/issue-templates');
  await templatesDialog.getByRole('button', { name: 'Create template' }).click();
  assert.equal((await createTemplate).status(), 201);
  const [template] = await postgres.db.select().from(issueTemplates).where(eq(issueTemplates.name, 'Browser intake form'));
  assert.ok(template);
  await templatesDialog.getByRole('button', { name: 'Close', exact: true }).first().click();
  await page.locator('header').getByRole('button', { name: 'New intake', exact: true }).click();
  const intakeDialog = page.getByRole('dialog', { name: 'New internal intake' });
  await intakeDialog.getByLabel('Intake title').fill('New browser report');
  await intakeDialog.getByLabel('What should we know?').fill('Template answer persists in issue description.');
  const submitIntake = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/issue-templates/${template.id}/submit`);
  await intakeDialog.getByRole('button', { name: 'Submit to triage' }).click();
  assert.equal((await submitIntake).status(), 201);
  const [intakeIssue] = await postgres.db.select().from(issues).where(eq(issues.title, 'New browser report'));
  assert.equal(intakeIssue.status, 'triage');
  assert.match(intakeIssue.description, /Template answer persists/);
  await page.getByText('New browser report', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Review' }).last().click();
  const review = page.getByRole('dialog', { name: `Review ${intakeIssue.identifier}` });
  await review.locator(`option[value="${member.id}"]`).waitFor({ state: 'attached' });
  await review.getByLabel('Route assignee').selectOption(member.id);
  const acceptRequest = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/triage/${intakeIssue.id}/accept`);
  await review.getByRole('button', { name: 'Accept & route' }).click();
  const acceptedResponse = await acceptRequest;
  assert.equal(acceptedResponse.status(), 201);
  const routedIssue = (await postgres.db.select().from(issues).where(eq(issues.id, intakeIssue.id)))[0];
  assert.equal(routedIssue.status, 'todo');
  assert.equal(routedIssue.assigneeId, member.id);
  assert.equal((await postgres.db.select().from(activities).where(eq(activities.type, 'issue.triage_accepted'))).length, 1);
  const declinedSubmit = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/issue-templates/${template.id}/submit`);
  await page.locator('header').getByRole('button', { name: 'New intake', exact: true }).click();
  const declineDialog = page.getByRole('dialog', { name: 'New internal intake' });
  await declineDialog.getByLabel('Intake title').fill('Decline browser report');
  await declineDialog.getByLabel('What should we know?').fill('This report will be declined.');
  await declineDialog.getByRole('button', { name: 'Submit to triage' }).click();
  assert.equal((await declinedSubmit).status(), 201);
  const [declinedIssue] = await postgres.db.select().from(issues).where(eq(issues.title, 'Decline browser report'));
  await page.getByText('Decline browser report', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Review' }).last().click();
  const declineReview = page.getByRole('dialog', { name: `Review ${declinedIssue.identifier}` });
  await declineReview.getByLabel('Decline reason').fill('Not actionable');
  const declineRequest = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/triage/${declinedIssue.id}/decline`);
  await declineReview.getByRole('button', { name: 'Decline', exact: true }).click();
  assert.equal((await declineRequest).status(), 201);
  assert.ok((await postgres.db.select().from(issues).where(eq(issues.id, declinedIssue.id)))[0].archivedAt);
  assert.equal((await postgres.db.select().from(activities).where(eq(activities.type, 'issue.triage_declined'))).length, 1);
  await page.locator('header').getByRole('button', { name: 'New intake', exact: true }).click();
  const duplicateSubmitDialog = page.getByRole('dialog', { name: 'New internal intake' });
  await duplicateSubmitDialog.getByLabel('Intake title').fill('Duplicate browser report');
  await duplicateSubmitDialog.getByLabel('What should we know?').fill('Duplicate details.');
  const duplicateSubmit = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/issue-templates/${template.id}/submit`);
  await duplicateSubmitDialog.getByRole('button', { name: 'Submit to triage' }).click();
  assert.equal((await duplicateSubmit).status(), 201);
  const [duplicateIssue] = await postgres.db.select().from(issues).where(eq(issues.title, 'Duplicate browser report'));
  await page.getByText('Duplicate browser report', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Review' }).last().click();
  const duplicateReview = page.getByRole('dialog', { name: `Review ${duplicateIssue.identifier}` });
  await duplicateReview.getByLabel('Duplicate target').selectOption(persisted.id);
  const duplicateRequest = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/triage/${duplicateIssue.id}/duplicate`);
  await duplicateReview.getByRole('button', { name: 'Mark duplicate' }).click();
  assert.equal((await duplicateRequest).status(), 201);
  assert.ok((await postgres.db.select().from(issues).where(eq(issues.id, duplicateIssue.id)))[0].archivedAt);
  assert.equal((await postgres.db.select().from(issueRelations).where(eq(issueRelations.duplicateSourceIssueId, duplicateIssue.id))).length, 1);
  assert.equal((await postgres.db.select().from(activities).where(eq(activities.type, 'issue.triage_duplicate'))).length, 1);
  for (const theme of ['dark', 'light']) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => localStorage.removeItem('foundation-e2e'));
    await page.goto(`${url}?theme=${theme}`);
    // Capture the existing dense mobile row honestly; full title visibility is
    // tracked in WORKFLOW_FOUNDATION.md for the final UI/accessibility review.
    await page.getByText('Real API browser foundation', { exact: true }).waitFor({ state: 'attached' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/reka-foundation-real-api-${theme}-${width}.png` });
  }
  for (const theme of ['dark', 'light']) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => localStorage.removeItem('foundation-e2e'));
    await page.goto(`${url}?page=triage&theme=${theme}`);
    await page.getByRole('heading', { name: 'Triage', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/reka-triage-${theme}-${width}.png` });
  }
  for (const theme of ['dark', 'light']) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => localStorage.removeItem('foundation-e2e'));
    await page.goto(`${url}?page=project&theme=${theme}`);
    await page.getByRole('heading', { name: 'Browser project', exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Milestones' }).click();
    await page.getByText('Browser delivery milestone', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/reka-project-milestones-${theme}-${width}.png` });
    await page.goto(`${url}?page=document&documentId=${createdDocumentId}&theme=${theme}`);
    await page.getByLabel('Document content in Markdown').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/reka-project-document-${theme}-${width}.png` });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: authenticated browser → Nest HTTP → isolated Postgres verifies saved views/search/favorites, issue/triage workflows, project lifecycle/milestones/dependencies/update subscriptions/documents, and initiative create/edit/project grouping/progress/roadmap dates/dependencies/restart. Issues, Favorites, Triage, Milestones, Documents, Initiatives and Roadmap desktop/mobile light/dark captures have no horizontal overflow. OAuth and live GitHub provider behavior are not validated by this browser test.');
} finally {
  if (browser) await browser.close();
  if (api) await api.close();
  await postgres.close();
}
