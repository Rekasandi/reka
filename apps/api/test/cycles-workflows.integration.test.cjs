// Cycle schedule, rollover, capacity and snapshots through real Nest HTTP + isolated Postgres.
const { equal, ok } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { and, eq, sql } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamMembers, teamWorkflowStates, sessions, cycles, issues, cycleSnapshots, issueHistory, teamCycleSettings } = require('@reka/database');
const { CyclesModule } = require('../dist/cycles/cycles.module');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');

test('cycle schedule validation, measured capacity, atomic rollover and immutable history snapshots', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  let api;
  try {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
    const [org] = await postgres.db.insert(organizations).values({ name: 'Cycle company', slug: `cycle-${suffix.toLowerCase()}` }).returning();
    const [owner, member, outsider] = await postgres.db.insert(users).values([
      { name: 'Cycle owner', email: `cycle-owner-${suffix}@example.test`, role: 'owner' },
      { name: 'Cycle member', email: `cycle-member-${suffix}@example.test`, role: 'member' },
      { name: 'Cycle outsider', email: `cycle-outsider-${suffix}@example.test`, role: 'owner' },
    ]).returning();
    await postgres.db.insert(organizationMembers).values([
      { organizationId: org.id, userId: owner.id, role: 'owner' },
      { organizationId: org.id, userId: member.id, role: 'member' },
    ]);
    const [team, otherTeam] = await postgres.db.insert(teams).values([
      { organizationId: org.id, name: 'Cycle team', key: `CYC${suffix}` },
      { organizationId: org.id, name: 'Other cycle team', key: `OTC${suffix}` },
    ]).returning();
    await postgres.db.insert(teamMembers).values([
      { teamId: team.id, userId: owner.id, role: 'lead' },
      { teamId: team.id, userId: member.id, role: 'member' },
      { teamId: otherTeam.id, userId: owner.id, role: 'lead' },
    ]);
    const states = ['triage', 'backlog', 'todo', 'in_progress', 'done', 'canceled'].map((key, index) => ({
      teamId: team.id, key, name: key, category: ({ triage: 'triage', backlog: 'backlog', todo: 'unstarted', in_progress: 'started', done: 'completed', canceled: 'canceled' })[key],
      color: '#777777', position: index,
    }));
    await postgres.db.insert(teamWorkflowStates).values(states);
    const tokens = {};
    for (const user of [owner, member, outsider]) {
      tokens[user.id] = randomUUID();
      await postgres.db.insert(sessions).values({ id: tokens[user.id], userId: user.id, expiresAt: new Date(Date.now() + 60_000) });
    }
    api = await createIsolatedApi(postgres, [CyclesModule]);
    const request = (user, path, method = 'GET', body) => fetch(`${api.url}/api${path}`, {
      method, headers: { Authorization: `Bearer ${tokens[user.id]}`, 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    equal((await request(owner, `/cycles/settings/${team.id}`)).status, 200);
    equal((await request(member, `/cycles/settings/${team.id}`, 'PUT', { timezone: 'UTC', durationDays: 14, cooldownDays: 0, nextStartDate: '2026-10-01', autoCreate: true })).status, 403);
    const settingsResponse = await request(owner, `/cycles/settings/${team.id}`, 'PUT', {
      timezone: 'America/Los_Angeles', durationDays: 10, cooldownDays: 2, nextStartDate: '2026-10-01', autoCreate: true,
    });
    equal(settingsResponse.status, 200, await settingsResponse.clone().text());
    equal((await settingsResponse.json()).timezone, 'America/Los_Angeles');
    equal((await request(owner, `/cycles/settings/${team.id}`, 'PUT', { timezone: 'Not/A_Zone', durationDays: 10, cooldownDays: 0, nextStartDate: '2026-10-01', autoCreate: false })).status, 400);
    equal((await request(outsider, `/cycles/settings/${team.id}`)).status, 403);
    equal((await postgres.db.select().from(teamCycleSettings).where(eq(teamCycleSettings.teamId, team.id))).length, 1);

    const start = '2026-10-01T00:00:00.000Z';
    const end = '2026-10-14T00:00:00.000Z';
    const firstResponse = await request(owner, '/cycles', 'POST', { teamId: team.id, name: 'Cycle Alpha', startDate: start, endDate: end, capacity: 18 });
    equal(firstResponse.status, 201, await firstResponse.clone().text());
    const first = await firstResponse.json();
    equal(first.capacity, 18);
    equal((await request(member, '/cycles', 'POST', { teamId: team.id, startDate: '2026-11-01T00:00:00.000Z', endDate: '2026-11-14T00:00:00.000Z' })).status, 403);
    equal((await request(owner, '/cycles', 'POST', { teamId: team.id, startDate: '2026-10-10T00:00:00.000Z', endDate: '2026-10-20T00:00:00.000Z' })).status, 400, 'open cycle overlap is rejected by database trigger');
    equal((await request(owner, '/cycles', 'POST', { teamId: team.id, startDate: '2026-10-20T00:00:00.000Z', endDate: '2026-10-20T00:00:00.000Z' })).status, 400, 'empty date ranges are rejected');
    const nextResponse = await request(owner, '/cycles', 'POST', { teamId: team.id, name: 'Cycle Beta', startDate: end, endDate: '2026-10-28T00:00:00.000Z' });
    equal(nextResponse.status, 201, await nextResponse.clone().text());
    const next = await nextResponse.json();
    const [wrongTeamTarget] = await postgres.db.insert(cycles).values({ teamId: otherTeam.id, number: 1, startDate: new Date('2026-10-14T00:00:00Z'), endDate: new Date('2026-10-28T00:00:00Z') }).returning();
    equal((await request(owner, `/cycles/${first.id}`, 'PATCH', { endDate: '2026-10-20T00:00:00.000Z' })).status, 400, 'cycle edits cannot create overlap');
    equal((await request(owner, `/cycles/${first.id}/complete`, 'POST', { incompleteIssuesAction: 'next_cycle', nextCycleId: wrongTeamTarget.id })).status, 400);

    const [done, activeIssue, noEstimate, backlog, triage, canceled, archivedActive] = await postgres.db.insert(issues).values([
      { identifier: `${team.key}-1`, number: 1, title: 'Done', teamId: team.id, reporterId: owner.id, status: 'done', cycleId: first.id, estimate: 3 },
      { identifier: `${team.key}-2`, number: 2, title: 'Active', teamId: team.id, reporterId: owner.id, status: 'in_progress', cycleId: first.id, estimate: 5 },
      { identifier: `${team.key}-3`, number: 3, title: 'Missing estimate', teamId: team.id, reporterId: owner.id, status: 'todo', cycleId: first.id },
      { identifier: `${team.key}-4`, number: 4, title: 'Backlog', teamId: team.id, reporterId: owner.id, status: 'backlog', cycleId: first.id, estimate: 8 },
      { identifier: `${team.key}-5`, number: 5, title: 'Triage', teamId: team.id, reporterId: owner.id, status: 'triage', cycleId: first.id, estimate: 9 },
      { identifier: `${team.key}-6`, number: 6, title: 'Canceled', teamId: team.id, reporterId: owner.id, status: 'canceled', cycleId: first.id, estimate: 10 },
      { identifier: `${team.key}-7`, number: 7, title: 'Archived active', teamId: team.id, reporterId: owner.id, status: 'in_progress', cycleId: first.id, archivedAt: new Date(), estimate: 11 },
    ]).returning();
    const detail = await (await request(member, `/cycles/${first.id}`)).json();
    equal(detail.totalIssues, 3); equal(detail.completedIssues, 1); equal(detail.remainingIssues, 2);
    equal(detail.plannedEstimate, 8); equal(detail.completedEstimate, 3); equal(detail.remainingEstimate, 5);
    equal(detail.missingEstimateCount, 1); equal(detail.remainingCapacity, 10);

    const complete = await request(owner, `/cycles/${first.id}/complete`, 'POST', { incompleteIssuesAction: 'next_cycle', nextCycleId: next.id });
    equal(complete.status, 201, await complete.clone().text());
    const result = await complete.json();
    equal(result.rolledOverCount, 2); equal(result.targetCycleId, next.id);
    const issueRows = await postgres.db.select().from(issues).where(and(eq(issues.teamId, team.id)));
    equal(issueRows.find(row => row.id === activeIssue.id).cycleId, next.id);
    equal(issueRows.find(row => row.id === noEstimate.id).cycleId, next.id);
    equal(issueRows.find(row => row.id === done.id).cycleId, first.id);
    equal(issueRows.find(row => row.id === backlog.id).cycleId, first.id);
    equal(issueRows.find(row => row.id === triage.id).cycleId, first.id);
    equal(issueRows.find(row => row.id === canceled.id).cycleId, first.id);
    equal(issueRows.find(row => row.id === archivedActive.id).cycleId, first.id);
    const replay = await (await request(owner, `/cycles/${first.id}/complete`, 'POST', { incompleteIssuesAction: 'backlog' })).json();
    equal(replay.rolledOverCount, 0); equal(replay.alreadyCompleted, true, 'repeat close is idempotent');
    const history = await (await request(member, `/cycles/${first.id}/history`)).json();
    equal(history.hasHistory, true); equal(history.snapshots.length, 1);
    equal(history.snapshots[0].totalIssueCount, 3); equal(history.snapshots[0].completedIssueCount, 1);
    equal(history.snapshots[0].remainingIssueCount, 2); equal(history.snapshots[0].plannedEstimate, 8);
    equal((await postgres.db.select().from(cycleSnapshots).where(eq(cycleSnapshots.cycleId, first.id))).length, 1);
    ok((await postgres.db.select().from(issueHistory).where(eq(issueHistory.issueId, activeIssue.id))).some(row => row.afterState?.cycle_id === next.id), 'rollover is recorded by issue history');

    // Reopening preserves delivered snapshots. Backlog rollover honors configured status categories.
    equal((await request(owner, `/cycles/${first.id}/reopen`, 'POST')).status, 201);
    equal((await postgres.db.select().from(cycleSnapshots).where(eq(cycleSnapshots.cycleId, first.id))).length, 1);
    const [backlogCycle] = await postgres.db.insert(cycles).values({ teamId: team.id, number: 10, startDate: new Date('2026-11-01T00:00:00Z'), endDate: new Date('2026-11-14T00:00:00Z') }).returning();
    const [backlogActionIssue] = await postgres.db.insert(issues).values({ identifier: `${team.key}-8`, number: 8, title: 'Return to backlog', teamId: team.id, reporterId: owner.id, status: 'in_progress', cycleId: backlogCycle.id }).returning();
    const backlogResult = await request(owner, `/cycles/${backlogCycle.id}/complete`, 'POST', { incompleteIssuesAction: 'backlog' });
    equal(backlogResult.status, 201);
    const savedBacklogIssue = (await postgres.db.select().from(issues).where(eq(issues.id, backlogActionIssue.id)))[0];
    equal(savedBacklogIssue.cycleId, null); equal(savedBacklogIssue.status, 'backlog');
    await postgres.reopen();
    equal((await postgres.db.select().from(cycleSnapshots).where(eq(cycleSnapshots.cycleId, first.id))).length, 1, 'snapshot records persist after process restart');
    equal((await request(owner, `/cycles/${first.id}/history`)).status, 200);
  } finally { await api?.close(); await postgres.close(); }
});
