// Per-team estimate scale + cycles/estimates enable switches through real Nest HTTP + isolated Postgres.
const { equal, deepEqual } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { eq } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamMembers, sessions, cycles, issues, teamCycleSettings } = require('@reka/database');
const { IssuesModule } = require('../dist/issues/issues.module');
const { TeamsModule } = require('../dist/teams/teams.module');
const { CyclesModule } = require('../dist/cycles/cycles.module');
const { processDueTeamCycleSchedules } = require('../../worker/dist/processors/cycle-planning');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');

test('estimate scale, estimates switch and cycles switch are enforced per team', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  let api;
  try {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
    const [org] = await postgres.db.insert(organizations).values({ name: 'Features company', slug: `feat-${suffix.toLowerCase()}` }).returning();
    const [owner, member] = await postgres.db.insert(users).values([
      { name: 'Owner', email: `feat-owner-${suffix}@example.test`, role: 'owner' },
      { name: 'Member', email: `feat-member-${suffix}@example.test`, role: 'member' },
    ]).returning();
    await postgres.db.insert(organizationMembers).values([
      { organizationId: org.id, userId: owner.id, role: 'owner' },
      { organizationId: org.id, userId: member.id, role: 'member' },
    ]);
    const [team] = await postgres.db.insert(teams).values({ organizationId: org.id, name: 'Feature team', key: `FT${suffix}` }).returning();
    await postgres.db.insert(teamMembers).values([{ teamId: team.id, userId: owner.id, role: 'lead' }, { teamId: team.id, userId: member.id, role: 'member' }]);
    const DAY = 86_400_000;
    const [cycle] = await postgres.db.insert(cycles).values({ teamId: team.id, number: 1, startDate: new Date(Date.now() - DAY), endDate: new Date(Date.now() + 6 * DAY) }).returning();
    const tokens = {};
    for (const user of [owner, member]) { tokens[user.id] = randomUUID(); await postgres.db.insert(sessions).values({ id: tokens[user.id], userId: user.id, expiresAt: new Date(Date.now() + 60_000) }); }
    api = await createIsolatedApi(postgres, [IssuesModule, TeamsModule, CyclesModule]);
    const request = (user, path, method = 'GET', body) => fetch(`${api.url}/api${path}`, {
      method, headers: { Authorization: `Bearer ${tokens[user.id]}`, 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const newIssue = async (extra = {}) => { const r = await request(owner, '/issues', 'POST', { title: 'Issue', teamId: team.id, assigneeId: null, ...extra }); return r; };
    const patchTeam = (user, body) => request(user, `/teams/${team.id}`, 'PATCH', body);

    // Defaults: Fibonacci, everything on.
    const initial = await (await request(owner, `/teams/${team.id}`)).json();
    deepEqual([initial.cyclesEnabled, initial.estimatesEnabled, initial.estimateScale], [true, true, 'fibonacci']);

    // Only managers can change settings; invalid scales are rejected.
    equal((await patchTeam(member, { estimateScale: 'linear' })).status, 403);
    equal((await patchTeam(owner, { estimateScale: 'bogus' })).status, 400);

    // Fibonacci: only scale values (or none) are accepted on create and update.
    equal((await newIssue({ estimate: 4 })).status, 400);
    const ok = await newIssue({ estimate: 5 });
    equal(ok.status, 201, await ok.clone().text());
    const issue = await ok.json();
    equal((await request(owner, `/issues/${issue.id}`, 'PATCH', { estimate: 6 })).status, 400);
    equal((await request(owner, `/issues/${issue.id}`, 'PATCH', { estimate: 8 })).status, 200);
    equal((await request(owner, `/issues/${issue.id}`, 'PATCH', { estimate: null })).status, 200);
    equal((await newIssue({ estimate: 0 })).status, 201, 'zero is on every scale');

    // Scale switch: linear rejects 8, free accepts any whole number; a legacy off-scale value survives unrelated edits.
    equal((await patchTeam(owner, { estimateScale: 'free' })).status, 200);
    const legacy = await (await newIssue({ estimate: 37 })).json();
    equal((await patchTeam(owner, { estimateScale: 'linear' })).status, 200);
    equal((await request(owner, `/issues/${legacy.id}`, 'PATCH', { title: 'Renamed' })).status, 200);
    equal((await request(owner, `/issues/${legacy.id}`, 'PATCH', { title: 'Renamed again', estimate: 37 })).status, 200, 'unchanged value is not re-validated');
    equal((await newIssue({ estimate: 8 })).status, 400);
    equal((await newIssue({ estimate: 4 })).status, 201);
    const bulkTarget = await (await newIssue()).json();
    equal((await request(owner, '/issues/bulk', 'PATCH', { ids: [bulkTarget.id], estimate: 8 })).status, 400);
    equal((await request(owner, '/issues/bulk', 'PATCH', { ids: [bulkTarget.id], estimate: 3 })).status, 200);

    // Estimates off: new values rejected, clearing allowed, stored values kept.
    equal((await patchTeam(owner, { estimatesEnabled: false })).status, 200);
    equal((await newIssue({ estimate: 3 })).status, 400);
    equal((await newIssue()).status, 201);
    equal((await request(owner, `/issues/${legacy.id}`, 'PATCH', { estimate: null })).status, 200);
    equal((await postgres.db.select().from(issues).where(eq(issues.id, bulkTarget.id)))[0].estimate, 3);

    // Cycles off: no assigning, no creating, no scheduling, no auto-create, no auto-add.
    const target = await (await newIssue()).json();
    equal((await request(owner, `/issues/${target.id}`, 'PATCH', { cycleId: cycle.id })).status, 200, 'enabled by default');
    await postgres.db.update(issues).set({ cycleId: null }).where(eq(issues.id, target.id));
    await postgres.db.insert(teamCycleSettings).values({ teamId: team.id, timezone: 'UTC', durationDays: 7, cooldownDays: 0, nextStartDate: '2020-01-01', autoCreate: true, autoAddStarted: true, updatedBy: owner.id });
    equal((await patchTeam(owner, { cyclesEnabled: false })).status, 200);
    equal((await request(owner, `/issues/${target.id}`, 'PATCH', { cycleId: cycle.id })).status, 400);
    equal((await newIssue({ cycleId: cycle.id })).status, 400);
    equal((await request(owner, `/issues/${target.id}`, 'PATCH', { status: 'in_progress' })).status, 200);
    equal((await postgres.db.select().from(issues).where(eq(issues.id, target.id)))[0].cycleId, null, 'auto-add is inactive while cycles are off');
    equal((await request(owner, '/cycles', 'POST', { teamId: team.id, startDate: new Date(Date.now() + 30 * DAY).toISOString(), endDate: new Date(Date.now() + 37 * DAY).toISOString() })).status, 400);
    equal((await request(owner, `/cycles/settings/${team.id}`, 'PUT', { timezone: 'UTC', durationDays: 7, cooldownDays: 0, nextStartDate: '2030-01-01', autoCreate: true })).status, 400);
    equal((await processDueTeamCycleSchedules(postgres.db, new Date())).length, 0, 'worker skips teams with cycles off');
    const before = (await postgres.db.select().from(cycles).where(eq(cycles.teamId, team.id))).length;

    // Re-enabling resumes the schedule.
    equal((await patchTeam(owner, { cyclesEnabled: true })).status, 200);
    equal((await processDueTeamCycleSchedules(postgres.db, new Date())).length, 1);
    equal((await postgres.db.select().from(cycles).where(eq(cycles.teamId, team.id))).length, before + 1);
  } finally {
    if (api) await api.close();
    await postgres.close();
  }
});
