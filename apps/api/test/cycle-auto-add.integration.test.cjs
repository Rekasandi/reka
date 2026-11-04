// "Auto-add started issues" cycle setting through real Nest HTTP + isolated Postgres.
const { equal } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { eq } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamMembers, sessions, cycles, issues } = require('@reka/database');
const { IssuesModule } = require('../dist/issues/issues.module');
const { CyclesModule } = require('../dist/cycles/cycles.module');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');

test('started issues join the current cycle only when the team enables auto-add', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  let api;
  try {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
    const [org] = await postgres.db.insert(organizations).values({ name: 'Auto-add company', slug: `auto-${suffix.toLowerCase()}` }).returning();
    const [owner] = await postgres.db.insert(users).values([{ name: 'Owner', email: `auto-${suffix}@example.test`, role: 'owner' }]).returning();
    await postgres.db.insert(organizationMembers).values({ organizationId: org.id, userId: owner.id, role: 'owner' });
    const [team] = await postgres.db.insert(teams).values({ organizationId: org.id, name: 'Auto team', key: `AUT${suffix}` }).returning();
    await postgres.db.insert(teamMembers).values({ teamId: team.id, userId: owner.id, role: 'lead' });
    const DAY = 86_400_000;
    const [current, upcoming] = await postgres.db.insert(cycles).values([
      { teamId: team.id, number: 1, startDate: new Date(Date.now() - 2 * DAY), endDate: new Date(Date.now() + 5 * DAY) },
      { teamId: team.id, number: 2, startDate: new Date(Date.now() + 6 * DAY), endDate: new Date(Date.now() + 12 * DAY) },
    ]).returning();
    const token = randomUUID();
    await postgres.db.insert(sessions).values({ token: token, userId: owner.id, expiresAt: new Date(Date.now() + 60_000) });
    api = await createIsolatedApi(postgres, [IssuesModule, CyclesModule]);
    const request = (path, method = 'GET', body) => fetch(`${api.url}/api${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const create = async (extra = {}) => { const r = await request('/issues', 'POST', { title: 'Issue', teamId: team.id, assigneeId: null, ...extra }); equal(r.status, 201, await r.clone().text()); return r.json(); };
    const cycleOf = async (id) => (await postgres.db.select().from(issues).where(eq(issues.id, id)))[0].cycleId;
    const saveSettings = async (autoAddStarted) => equal((await request(`/cycles/settings/${team.id}`, 'PUT', {
      timezone: 'UTC', durationDays: 7, cooldownDays: 0, nextStartDate: '2030-01-01', autoCreate: false, autoAddStarted,
    })).status, 200);

    // Disabled by default: no cycle is attached.
    const off = await create();
    equal((await request(`/issues/${off.id}`, 'PATCH', { status: 'in_progress' })).status, 200);
    equal(await cycleOf(off.id), null);

    await saveSettings(true);
    equal((await (await request(`/cycles/settings/${team.id}`)).json()).autoAddStarted, true);

    // Moving to a started status adds the issue to the current (not upcoming) cycle.
    const moved = await create();
    equal((await request(`/issues/${moved.id}`, 'PATCH', { status: 'in_progress' })).status, 200);
    equal(await cycleOf(moved.id), current.id);

    // Non-started statuses and issues with an existing cycle are left alone.
    const todo = await create({ status: 'todo' });
    equal(await cycleOf(todo.id), null);
    const planned = await create({ cycleId: upcoming.id });
    equal((await request(`/issues/${planned.id}`, 'PATCH', { status: 'in_progress' })).status, 200);
    equal(await cycleOf(planned.id), upcoming.id);

    // Creating directly in a started status joins the current cycle; an explicit cycle wins.
    equal(await cycleOf((await create({ status: 'in_progress' })).id), current.id);
    equal(await cycleOf((await create({ status: 'in_progress', cycleId: upcoming.id })).id), upcoming.id);

    // Bulk status change.
    const [a, b] = [await create(), await create({ cycleId: upcoming.id })];
    equal((await request('/issues/bulk', 'PATCH', { ids: [a.id, b.id], status: 'in_progress' })).status, 200);
    equal(await cycleOf(a.id), current.id);
    equal(await cycleOf(b.id), upcoming.id);

    // No open current cycle -> nothing to join.
    await postgres.db.update(cycles).set({ isCompleted: true }).where(eq(cycles.id, current.id));
    const none = await create();
    equal((await request(`/issues/${none.id}`, 'PATCH', { status: 'in_progress' })).status, 200);
    equal(await cycleOf(none.id), null);
  } finally {
    if (api) await api.close();
    await postgres.close();
  }
});
