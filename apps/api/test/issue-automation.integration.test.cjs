// Auto-close parent, auto-archive, automatic cycle rollover, reactions and label groups
// through real Nest HTTP + isolated Postgres (and the real worker functions).
const { equal, ok, deepEqual } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { eq } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamMembers, sessions, cycles, issues, teamCycleSettings, activities } = require('@reka/database');
const { IssuesModule } = require('../dist/issues/issues.module');
const { TeamsModule } = require('../dist/teams/teams.module');
const { CyclesModule } = require('../dist/cycles/cycles.module');
const { LabelsModule } = require('../dist/labels/labels.module');
const { CommentsModule } = require('../dist/comments/comments.module');
const { ReactionsModule } = require('../dist/reactions/reactions.module');
const { closeEndedCycles } = require('../../worker/dist/processors/cycle-planning');
const { processAutoArchive, processAutoCloseStale } = require('../../worker/dist/processors/auto-archive');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');

const DAY = 86_400_000;

async function fixture() {
  const postgres = await createPersistentPostgres();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
  const [org] = await postgres.db.insert(organizations).values({ name: 'Automation company', slug: `auto-${suffix.toLowerCase()}` }).returning();
  const [owner, member, outsider] = await postgres.db.insert(users).values([
    { name: 'Owner', email: `o-${suffix}@example.test`, role: 'owner' }, { name: 'Member', email: `m-${suffix}@example.test`, role: 'member' },
    { name: 'Outsider', email: `x-${suffix}@example.test`, role: 'owner' },
  ]).returning();
  await postgres.db.insert(organizationMembers).values([{ organizationId: org.id, userId: owner.id, role: 'owner' }, { organizationId: org.id, userId: member.id, role: 'member' }]);
  const [team] = await postgres.db.insert(teams).values({ organizationId: org.id, name: 'Auto team', key: `AU${suffix}` }).returning();
  await postgres.db.insert(teamMembers).values([{ teamId: team.id, userId: owner.id, role: 'lead' }, { teamId: team.id, userId: member.id, role: 'member' }]);
  const tokens = {};
  for (const user of [owner, member, outsider]) { tokens[user.id] = randomUUID(); await postgres.db.insert(sessions).values({ id: tokens[user.id], userId: user.id, expiresAt: new Date(Date.now() + 120_000) }); }
  const api = await createIsolatedApi(postgres, [IssuesModule, TeamsModule, CyclesModule, LabelsModule, CommentsModule, ReactionsModule]);
  const request = (user, path, method = 'GET', body, signal) => fetch(`${api.url}/api${path}`, {
    method, signal, headers: { Authorization: `Bearer ${tokens[user.id]}`, 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const create = async (extra = {}) => { const r = await request(owner, '/issues', 'POST', { title: 'Issue', teamId: team.id, assigneeId: null, ...extra }); equal(r.status, 201, await r.clone().text()); return r.json(); };
  const row = async (id) => (await postgres.db.select().from(issues).where(eq(issues.id, id)))[0];
  return { postgres, api, org, owner, member, outsider, team, request, create, row, close: async () => { await api.close(); await postgres.close(); } };
}

test('team automation settings validate and persist', { timeout: 60000 }, async () => {
  const f = await fixture();
  try {
    equal((await f.request(f.member, `/teams/${f.team.id}`, 'PATCH', { autoCloseParent: true })).status, 403);
    for (const bad of [0, 61, 1.5]) equal((await f.request(f.owner, `/teams/${f.team.id}`, 'PATCH', { autoArchiveMonths: bad })).status, 400, `months ${bad}`);
    equal((await f.request(f.owner, `/teams/${f.team.id}`, 'PATCH', { autoCloseParent: true, autoArchiveMonths: 6 })).status, 200);
    const saved = await (await f.request(f.owner, `/teams/${f.team.id}`)).json();
    deepEqual([saved.autoCloseParent, saved.autoArchiveMonths], [true, 6]);
    equal((await f.request(f.owner, `/teams/${f.team.id}`, 'PATCH', { autoArchiveMonths: null })).status, 200);
    equal((await (await f.request(f.owner, `/teams/${f.team.id}`)).json()).autoArchiveMonths, null);
  } finally { await f.close(); }
});

test('auto-close parent closes parents up the hierarchy only when enabled and all sub-issues are closed', { timeout: 60000 }, async () => {
  const f = await fixture();
  try {
    const grand = await f.create(); const parent = await f.create({ parentId: grand.id });
    const a = await f.create({ parentId: parent.id }); const b = await f.create({ parentId: parent.id });
    const setStatus = async (id, status) => equal((await f.request(f.owner, `/issues/${id}`, 'PATCH', { status })).status, 200);

    await setStatus(a.id, 'done'); await setStatus(b.id, 'done');
    equal((await f.row(parent.id)).status, 'todo', 'off by default');
    await setStatus(a.id, 'todo'); await setStatus(b.id, 'todo');

    equal((await f.request(f.owner, `/teams/${f.team.id}`, 'PATCH', { autoCloseParent: true })).status, 200);
    await setStatus(a.id, 'done');
    equal((await f.row(parent.id)).status, 'todo', 'one open sub-issue keeps the parent open');
    await setStatus(b.id, 'canceled');
    equal((await f.row(parent.id)).status, 'done', 'all closed with a completed one -> parent completed');
    equal((await f.row(grand.id)).status, 'done', 'and the grandparent, since parent is its only sub-issue');
    const auto = await f.postgres.db.select().from(activities).where(eq(activities.issueId, parent.id));
    ok(auto.some((event) => event.type === 'issue.status_changed' && event.metadata.auto), 'auto close is recorded as activity');

    // All canceled -> parent canceled. Bulk update path.
    const p2 = await f.create(); const c1 = await f.create({ parentId: p2.id }); const c2 = await f.create({ parentId: p2.id });
    equal((await f.request(f.owner, '/issues/bulk', 'PATCH', { ids: [c1.id, c2.id], status: 'canceled' })).status, 200);
    equal((await f.row(p2.id)).status, 'canceled');
  } finally { await f.close(); }
});

test('auto-archive archives only old closed issues of opted-in teams and waits for open children', { timeout: 60000 }, async () => {
  const f = await fixture();
  try {
    const old = new Date(Date.now() - 100 * DAY);
    const oldDone = await f.create({ status: 'done' }); const oldOpen = await f.create(); const freshDone = await f.create({ status: 'done' });
    const parent = await f.create({ status: 'done' }); const child = await f.create({ status: 'todo', parentId: parent.id });
    for (const issue of [oldDone, oldOpen, parent, child]) await f.postgres.db.update(issues).set({ updatedAt: old }).where(eq(issues.id, issue.id));

    equal((await processAutoArchive(f.postgres.db)).length, 0, 'off by default');
    equal((await f.request(f.owner, `/teams/${f.team.id}`, 'PATCH', { autoArchiveMonths: 3 })).status, 200);
    const archived = await processAutoArchive(f.postgres.db);
    deepEqual(archived.map((r) => r.issue_id), [oldDone.id]);
    ok((await f.row(oldDone.id)).archivedAt, 'old closed issue archived');
    for (const issue of [oldOpen, freshDone, parent, child]) equal((await f.row(issue.id)).archivedAt, null);
    equal((await processAutoArchive(f.postgres.db)).length, 0, 'idempotent');
    const events = await f.postgres.db.select().from(activities).where(eq(activities.issueId, oldDone.id));
    ok(events.some((event) => event.type === 'issue.auto_archived' && event.actorId === null));
    // Restoring through the API still works for auto-archived issues.
    equal((await f.request(f.owner, `/issues/${oldDone.id}/restore`, 'POST')).status < 300, true);
  } finally { await f.close(); }
});

test('ended cycles close automatically and roll unfinished work forward only when enabled', { timeout: 60000 }, async () => {
  const f = await fixture();
  try {
    const [ended, next] = await f.postgres.db.insert(cycles).values([
      { teamId: f.team.id, number: 1, startDate: new Date(Date.now() - 14 * DAY), endDate: new Date(Date.now() - DAY) },
      { teamId: f.team.id, number: 2, startDate: new Date(Date.now() - 1000), endDate: new Date(Date.now() + 13 * DAY) },
    ]).returning();
    const doing = await f.create({ status: 'in_progress', cycleId: ended.id }); const done = await f.create({ status: 'done', cycleId: ended.id });
    equal((await closeEndedCycles(f.postgres.db)).length, 0, 'no settings row');
    await f.postgres.db.insert(teamCycleSettings).values({ teamId: f.team.id, timezone: 'UTC', durationDays: 14, cooldownDays: 0, nextStartDate: '2031-01-01', autoCreate: false, autoRollover: false, updatedBy: f.owner.id });
    equal((await closeEndedCycles(f.postgres.db)).length, 0, 'off by default');

    // Saved through the API (manager only).
    const body = { timezone: 'UTC', durationDays: 14, cooldownDays: 0, nextStartDate: '2031-01-01', autoCreate: false, autoRollover: true };
    equal((await f.request(f.member, `/cycles/settings/${f.team.id}`, 'PUT', body)).status, 403);
    equal((await f.request(f.owner, `/cycles/settings/${f.team.id}`, 'PUT', body)).status, 200);
    equal((await (await f.request(f.owner, `/cycles/settings/${f.team.id}`)).json()).autoRollover, true);

    const closed = await closeEndedCycles(f.postgres.db);
    deepEqual(closed.map((c) => [c.id, c.rolledOver]), [[ended.id, 1]]);
    equal((await f.postgres.db.select().from(cycles).where(eq(cycles.id, ended.id)))[0].isCompleted, true);
    equal((await f.row(doing.id)).cycleId, next.id, 'unfinished issue rolled into the next cycle');
    equal((await f.row(done.id)).cycleId, ended.id, 'finished issue stays in the closed cycle');
    equal((await closeEndedCycles(f.postgres.db)).length, 0, 'idempotent');

    // No later open cycle: it stays open (retried later) instead of failing or dropping work.
    await f.postgres.db.update(cycles).set({ endDate: new Date(Date.now() - 1000), startDate: new Date(Date.now() - 15 * DAY) }).where(eq(cycles.id, next.id));
    equal((await closeEndedCycles(f.postgres.db)).length, 0);
    equal((await f.postgres.db.select().from(cycles).where(eq(cycles.id, next.id)))[0].isCompleted, false);
    equal((await f.row(doing.id)).cycleId, next.id);
  } finally { await f.close(); }
});

test('reactions toggle on issues and comments with per-user state, validation and access control', { timeout: 60000 }, async () => {
  const f = await fixture();
  try {
    const issue = await f.create();
    const commentResponse = await f.request(f.owner, `/comments/by-issue/${issue.id}`, 'POST', { body: 'Hello' });
    equal(commentResponse.status, 201, await commentResponse.clone().text());
    const comment = await commentResponse.json();
    const toggle = (user, body) => f.request(user, '/reactions/toggle', 'PUT', body);

    equal((await toggle(f.owner, { issueId: issue.id, emoji: '🚀' })).status, 200);
    equal((await toggle(f.member, { issueId: issue.id, emoji: '🚀' })).status, 200);
    equal((await toggle(f.owner, { commentId: comment.id, emoji: '👍' })).status, 200);
    let seen = await (await f.request(f.member, `/reactions/by-issue/${issue.id}`)).json();
    deepEqual(seen.issue, [{ emoji: '🚀', count: 2, reacted: true }]);
    deepEqual(seen.comments[comment.id], [{ emoji: '👍', count: 1, reacted: false }]);

    const off = await (await toggle(f.owner, { issueId: issue.id, emoji: '🚀' })).json();
    equal(off.active, false);
    seen = await (await f.request(f.owner, `/reactions/by-issue/${issue.id}`)).json();
    deepEqual(seen.issue, [{ emoji: '🚀', count: 1, reacted: false }]);

    equal((await toggle(f.owner, { issueId: issue.id, emoji: '🙈' })).status, 400, 'emoji must be allowed');
    equal((await toggle(f.owner, { emoji: '👍' })).status, 400, 'needs a target');
    equal((await toggle(f.owner, { issueId: issue.id, commentId: comment.id, emoji: '👍' })).status, 400, 'exactly one target');
    equal((await toggle(f.outsider, { issueId: issue.id, emoji: '👍' })).status >= 400, true, 'outsiders cannot react');
    equal((await f.request(f.outsider, `/reactions/by-issue/${issue.id}`)).status >= 400, true, 'outsiders cannot read');
  } finally { await f.close(); }
});

test('label groups are one level deep and an issue holds at most one label per group', { timeout: 60000 }, async () => {
  const f = await fixture();
  try {
    const label = async (body) => f.request(f.owner, '/labels', 'POST', { teamId: f.team.id, ...body });
    const group = await (await label({ name: 'Area', color: '#336699' })).json();
    const web = await (await label({ name: 'Web', parentId: group.id })).json();
    const api = await (await label({ name: 'API', parentId: group.id })).json();
    const bug = await (await label({ name: 'Bug' })).json();
    equal(web.parentId, group.id);

    equal((await label({ name: 'Nested', parentId: web.id })).status, 400, 'groups cannot nest');
    equal((await f.request(f.owner, `/labels/${group.id}`, 'PATCH', { parentId: bug.id })).status, 400, 'a group label cannot join another group');
    equal((await f.request(f.owner, `/labels/${web.id}`, 'PATCH', { parentId: web.id })).status, 400, 'not its own group');
    const other = await (await f.request(f.owner, '/labels', 'POST', { teamId: f.team.id, name: 'Other group' })).json();
    equal((await f.request(f.owner, `/labels/${bug.id}`, 'PATCH', { parentId: other.id })).status, 200);

    const mixed = await f.request(f.owner, '/issues', 'POST', { title: 'Two of a group', teamId: f.team.id, assigneeId: null, labelIds: [web.id, api.id] });
    equal(mixed.status, 400, 'two labels from one group are rejected');
    equal((await f.request(f.owner, '/issues', 'POST', { title: 'One of a group', teamId: f.team.id, assigneeId: null, labelIds: [web.id, bug.id] })).status, 201);

    equal((await f.request(f.owner, `/labels/${web.id}`, 'PATCH', { parentId: null })).status, 200, 'ungroup');
    equal((await (await f.request(f.owner, '/labels')).json()).find((l) => l.id === web.id).parentId, null);
    equal((await f.request(f.owner, `/labels/${group.id}`, 'DELETE')).status, 200);
    equal((await (await f.request(f.owner, '/labels')).json()).find((l) => l.id === api.id).parentId, null, 'children are ungrouped when the group is deleted');
  } finally { await f.close(); }
});

// A team created through the API gets the seeded workflow (incl. Duplicate, no Blocked) with cycles/estimates off.
async function apiTeam(f, extra = {}) {
  const r = await f.request(f.owner, '/teams', 'POST', { name: 'Parity', key: `PA${randomUUID().replaceAll('-', '').slice(0, 5).toUpperCase()}` });
  equal(r.status, 201, await r.clone().text());
  const team = await r.json();
  if (Object.keys(extra).length) equal((await f.request(f.owner, `/teams/${team.id}`, 'PATCH', extra)).status, 200);
  const create = async (body = {}) => { const res = await f.request(f.owner, '/issues', 'POST', { title: 'Issue', teamId: team.id, assigneeId: null, ...body }); equal(res.status, 201, await res.clone().text()); return res.json(); };
  return { team, create };
}

test('new teams start with cycles and estimates off and the Linear default workflow', { timeout: 60000 }, async () => {
  const f = await fixture();
  try {
    const { team } = await apiTeam(f);
    deepEqual([team.cyclesEnabled, team.estimatesEnabled, team.triageEnabled, team.slaEnabled], [false, false, true, false]);
    const keys = (await (await f.request(f.owner, `/teams/${team.id}/workflow-states`)).json()).map((s) => s.key);
    ok(keys.includes('duplicate') && !keys.includes('blocked'), keys.join(','));
  } finally { await f.close(); }
});

test('default status, duplicate status and their workflow guards', { timeout: 60000 }, async () => {
  const f = await fixture();
  try {
    const { team, create } = await apiTeam(f);
    equal((await create()).status, 'todo', 'automatic default is the first unstarted state');
    equal((await f.request(f.owner, `/teams/${team.id}`, 'PATCH', { defaultStatus: 'done' })).status, 400, 'default must be backlog/unstarted');
    equal((await f.request(f.owner, `/teams/${team.id}`, 'PATCH', { defaultStatus: 'nope' })).status, 400);
    equal((await f.request(f.owner, `/teams/${team.id}`, 'PATCH', { defaultStatus: 'backlog' })).status, 200);
    equal((await create()).status, 'backlog');
    const states = await (await f.request(f.owner, `/teams/${team.id}/workflow-states`)).json();
    equal(states.find((state) => state.key === 'backlog').issueCount, 1, 'workflow states report how many issues use them');
    equal(states.find((state) => state.key === 'done').issueCount, 0);
    const withoutBacklog = states.map(({ key, name, category, color, position, isActive }) => ({ key, name, category, color, position, isActive: key === 'backlog' ? false : isActive }));
    equal((await f.request(f.owner, `/teams/${team.id}/workflow-states`, 'PATCH', { states: withoutBacklog })).status, 400, 'referenced default cannot be disabled');

    const original = await create({ status: 'in_progress' }); const copy = await create({ status: 'in_progress' });
    equal((await f.request(f.owner, `/issues/${copy.id}/relations`, 'POST', { relatedIssueId: original.id, type: 'duplicate' })).status, 201);
    equal((await f.row(copy.id)).status, 'duplicate', 'duplicate moves to the Duplicate state');
    equal((await f.row(original.id)).status, 'in_progress', 'the canonical issue is untouched');
    equal((await f.request(f.owner, `/teams/${team.id}`, 'PATCH', { duplicateStatus: 'canceled' })).status, 200);
    const third = await create();
    await f.request(f.owner, `/issues/${third.id}/relations`, 'POST', { relatedIssueId: original.id, type: 'duplicate' });
    equal((await f.row(third.id)).status, 'canceled', 'configured duplicate status wins');
    equal((await f.request(f.owner, `/teams/${team.id}`, 'PATCH', { duplicateStatus: 'todo' })).status, 400, 'duplicate must be canceled');
    equal((await f.request(f.owner, `/teams/${team.id}`, 'PATCH', { githubMergedStatus: '-' })).status, 200, "'-' means no change for GitHub");
    equal((await f.request(f.owner, `/teams/${team.id}`, 'PATCH', { defaultStatus: '-' })).status, 400, "'-' is only for GitHub");
  } finally { await f.close(); }
});

test('triage can be turned off only with an empty queue and then rejects triage statuses', { timeout: 60000 }, async () => {
  const f = await fixture();
  try {
    const { team, create } = await apiTeam(f);
    const waiting = await create({ status: 'triage' });
    equal((await f.request(f.owner, `/teams/${team.id}`, 'PATCH', { triageEnabled: false })).status, 400, 'queue must be empty');
    equal((await f.request(f.owner, `/issues/${waiting.id}`, 'PATCH', { status: 'todo' })).status, 200);
    equal((await f.request(f.owner, `/teams/${team.id}`, 'PATCH', { triageEnabled: false })).status, 200);
    equal((await f.request(f.owner, '/issues', 'POST', { title: 'x', teamId: team.id, assigneeId: null, status: 'triage' })).status, 400);
  } finally { await f.close(); }
});

test('SLA deadlines follow priority and close with the issue', { timeout: 60000 }, async () => {
  const f = await fixture();
  try {
    const { team, create } = await apiTeam(f);
    const existing = await create({ priority: 'urgent' }); const closedHigh = await create({ priority: 'high', status: 'done' });
    equal((await f.row(existing.id)).slaBreachesAt, null, 'off by default');
    equal((await f.request(f.owner, `/teams/${team.id}`, 'PATCH', { slaEnabled: true })).status, 200);
    ok((await f.row(existing.id)).slaBreachesAt, 'turning SLA on starts the clock for open urgent issues');
    equal((await f.row(closedHigh.id)).slaBreachesAt, null, 'closed issues get no SLA');
    const urgent = await create({ priority: 'urgent' });
    const hours = ((await f.row(urgent.id)).slaBreachesAt.getTime() - Date.now()) / 3_600_000;
    ok(hours > 23 && hours <= 24, `urgent = 1 day (${hours})`);
    await f.request(f.owner, `/issues/${urgent.id}`, 'PATCH', { priority: 'high' });
    ok((await f.row(urgent.id)).slaBreachesAt.getTime() - Date.now() > 6 * DAY, 'high = 7 days');
    await f.request(f.owner, `/issues/${urgent.id}`, 'PATCH', { priority: 'low' });
    equal((await f.row(urgent.id)).slaBreachesAt, null, 'low has no SLA');
    const high = await create({ priority: 'high' });
    await f.request(f.owner, `/issues/${high.id}`, 'PATCH', { status: 'done' });
    equal((await f.row(high.id)).slaBreachesAt, null, 'closed issues drop the SLA');
    equal((await f.request(f.owner, `/teams/${team.id}`, 'PATCH', { slaEnabled: false })).status, 200);
    equal((await f.row(existing.id)).slaBreachesAt, null, 'turning SLA off clears deadlines');
  } finally { await f.close(); }
});

test('auto-close sub-issues and stale issues', { timeout: 60000 }, async () => {
  const f = await fixture();
  try {
    const { team, create } = await apiTeam(f);
    const parent = await create(); const child = await create({ parentId: parent.id }); const grandchild = await create({ parentId: child.id });
    const finished = await create({ parentId: parent.id, status: 'done' });
    await f.request(f.owner, `/issues/${parent.id}`, 'PATCH', { status: 'canceled' });
    equal((await f.row(child.id)).status, 'todo', 'off by default');
    await f.request(f.owner, `/issues/${parent.id}`, 'PATCH', { status: 'todo' });
    equal((await f.request(f.owner, `/teams/${team.id}`, 'PATCH', { autoCloseChildren: true })).status, 200);
    await f.request(f.owner, `/issues/${parent.id}`, 'PATCH', { status: 'canceled' });
    deepEqual([(await f.row(child.id)).status, (await f.row(grandchild.id)).status, (await f.row(finished.id)).status], ['canceled', 'canceled', 'done']);

    const old = new Date(Date.now() - 100 * DAY);
    const stale = await create({ status: 'backlog' }); const started = await create({ status: 'in_progress' }); const fresh = await create();
    for (const issue of [stale, started]) await f.postgres.db.update(issues).set({ updatedAt: old }).where(eq(issues.id, issue.id));
    equal((await processAutoCloseStale(f.postgres.db)).length, 0, 'off by default');
    equal((await f.request(f.owner, `/teams/${team.id}`, 'PATCH', { autoCloseStaleMonths: 3 })).status, 200);
    deepEqual((await processAutoCloseStale(f.postgres.db)).map((r) => r.issue_id), [stale.id]);
    deepEqual([(await f.row(stale.id)).status, (await f.row(started.id)).status, (await f.row(fresh.id)).status], ['canceled', 'in_progress', 'todo']);
    equal((await processAutoCloseStale(f.postgres.db)).length, 0, 'idempotent');
  } finally { await f.close(); }
});

test('issue writes push a live "issues" event to teammates over the SSE stream', { timeout: 60000 }, async () => {
  const f = await fixture();
  const controller = new AbortController();
  try {
    const response = await f.request(f.member, '/notifications/unread-count/stream', 'GET', undefined, controller.signal);
    equal(response.headers.get('content-type')?.startsWith('text/event-stream'), true);
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let text = '';
    const until = async (pattern) => { const end = Date.now() + 10000; while (!pattern.test(text)) { if (Date.now() > end) throw new Error(`no ${pattern} in ${text}`); const { value } = await reader.read(); text += decoder.decode(value); } };
    await until(/"count"/);
    await f.create();
    await until(/event: issues/);
    ok(text.includes(f.team.id), 'event names the changed team');
  } finally { controller.abort(); await f.close(); }
});

test('deleting an issue removes notifications that point at it', { timeout: 60000 }, async () => {
  const f = await fixture();
  try {
    const { notifications } = require('@reka/database');
    const parent = await f.create(); const child = await f.create({ parentId: parent.id }); const other = await f.create();
    await f.postgres.db.insert(notifications).values([parent, child, other].map((issue) => ({ userId: f.member.id, type: 'assignment', title: issue.identifier, body: 'b', metadata: { issueId: issue.id, issueIdentifier: issue.identifier } })));
    equal((await f.request(f.owner, `/issues/${parent.id}`, 'DELETE')).status, 200);
    const left = await f.postgres.db.select().from(notifications).where(eq(notifications.userId, f.member.id));
    deepEqual(left.map((row) => row.metadata.issueId), [other.id], 'parent and sub-issue notifications are gone');
  } finally { await f.close(); }
});
