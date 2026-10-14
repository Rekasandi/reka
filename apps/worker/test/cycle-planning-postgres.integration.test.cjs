const { equal, ok } = require('node:assert/strict');
const { test } = require('node:test');
const { eq } = require('drizzle-orm');
const { organizations, users, teams, organizationMembers, teamMembers, teamWorkflowStates, cycles, teamCycleSettings, issues, cycleSnapshots } = require('@reka/database');
const { createPersistentPostgres } = require('../../api/test/support/persistent-postgres.cjs');
const { processDueTeamCycleSchedules, captureCurrentCycleSnapshots } = require('../dist/processors/cycle-planning');

test('automatic team cycles honor IANA dates/cooldowns and replay once; burndown snapshots are immutable samples', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  try {
    const db = postgres.db;
    const suffix = `${Date.now()}`;
    const [org] = await db.insert(organizations).values({ name: 'Cycle worker company', slug: `cycle-worker-${suffix}` }).returning();
    const [owner] = await db.insert(users).values({ name: 'Cycle worker owner', email: `cycle-worker-${suffix}@example.test` }).returning();
    await db.insert(organizationMembers).values({ organizationId: org.id, userId: owner.id, role: 'owner' });
    const [team, blockedTeam] = await db.insert(teams).values([
      { organizationId: org.id, name: 'Scheduled team', key: `S${suffix.slice(-5)}` },
      { organizationId: org.id, name: 'Blocked team', key: `B${suffix.slice(-5)}` },
    ]).returning();
    await db.insert(teamMembers).values([{ teamId: team.id, userId: owner.id, role: 'lead' }, { teamId: blockedTeam.id, userId: owner.id, role: 'lead' }]);
    await db.insert(teamWorkflowStates).values([
      { teamId: team.id, key: 'backlog', name: 'Backlog', category: 'backlog', color: '#777777', position: 0 },
      { teamId: team.id, key: 'todo', name: 'Todo', category: 'unstarted', color: '#777777', position: 1 },
      { teamId: team.id, key: 'doing', name: 'Doing', category: 'started', color: '#777777', position: 2 },
      { teamId: team.id, key: 'shipped', name: 'Shipped', category: 'completed', color: '#777777', position: 3 },
      { teamId: team.id, key: 'canceled', name: 'Canceled', category: 'canceled', color: '#777777', position: 4 },
      { teamId: blockedTeam.id, key: 'backlog', name: 'Backlog', category: 'backlog', color: '#777777', position: 0 },
      { teamId: blockedTeam.id, key: 'todo', name: 'Todo', category: 'unstarted', color: '#777777', position: 1 },
      { teamId: blockedTeam.id, key: 'doing', name: 'Doing', category: 'started', color: '#777777', position: 2 },
      { teamId: blockedTeam.id, key: 'shipped', name: 'Shipped', category: 'completed', color: '#777777', position: 3 },
      { teamId: blockedTeam.id, key: 'canceled', name: 'Canceled', category: 'canceled', color: '#777777', position: 4 },
    ]);
    const [blockedCycle] = await db.insert(cycles).values({ teamId: blockedTeam.id, number: 1, startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-14T00:00:00Z') }).returning();
    await db.insert(teamCycleSettings).values([
      { teamId: team.id, timezone: 'America/Los_Angeles', durationDays: 10, cooldownDays: 2, nextStartDate: '2026-10-01', autoCreate: true, updatedBy: owner.id },
      { teamId: blockedTeam.id, timezone: 'UTC', durationDays: 14, cooldownDays: 1, nextStartDate: '2026-10-01', autoCreate: true, updatedBy: owner.id },
    ]);
    const firstRun = await processDueTeamCycleSchedules(db, new Date('2026-10-01T07:00:00.000Z'));
    equal(firstRun.length, 1, 'one scheduled team created; blocked overlap was safely skipped');
    const [first] = await db.select().from(cycles).where(eq(cycles.teamId, team.id));
    equal(first.scheduledStartDate, '2026-10-01');
    equal(first.startDate.toISOString(), '2026-10-01T07:00:00.000Z', 'start is local midnight in PDT');
    equal(first.endDate.toISOString(), '2026-10-11T06:59:59.999Z', 'duration uses local calendar days across timezone offsets');
    const [savedSettings] = await db.select().from(teamCycleSettings).where(eq(teamCycleSettings.teamId, team.id));
    equal(savedSettings.nextStartDate, '2026-10-13');
    const [blockedSettings] = await db.select().from(teamCycleSettings).where(eq(teamCycleSettings.teamId, blockedTeam.id));
    equal(blockedSettings.nextStartDate, '2026-10-16', 'overlap advances the schedule beyond the existing cycle and cooldown');
    equal((await processDueTeamCycleSchedules(db, new Date('2026-10-01T07:00:00.000Z'))).length, 0, 'replay cannot duplicate or advance a not-due schedule');
    const secondRun = await processDueTeamCycleSchedules(db, new Date('2026-10-13T07:00:00.000Z'));
    equal(secondRun.length, 1);
    const teamCycles = await db.select().from(cycles).where(eq(cycles.teamId, team.id)).orderBy(cycles.number);
    equal(teamCycles.length, 2); equal(teamCycles[1].number, 2); equal(teamCycles[1].scheduledStartDate, '2026-10-13');
    equal((await processDueTeamCycleSchedules(db, new Date('2026-10-13T07:00:00.000Z'))).length, 0);

    const sampleAt = new Date('2026-10-14T12:00:00.000Z');
    const [sampleCycle] = await db.insert(cycles).values({ teamId: blockedTeam.id, number: 2, startDate: new Date(sampleAt.getTime() - 60_000), endDate: new Date(sampleAt.getTime() + 86_400_000), capacity: 20 }).returning();
    const [remainingIssue, completedIssue, canceledIssue] = await db.insert(issues).values([
      { identifier: `${blockedTeam.key}-1`, number: 1, title: 'Remaining', teamId: blockedTeam.id, reporterId: owner.id, status: 'doing', cycleId: sampleCycle.id, estimate: 5 },
      { identifier: `${blockedTeam.key}-2`, number: 2, title: 'Completed', teamId: blockedTeam.id, reporterId: owner.id, status: 'shipped', cycleId: sampleCycle.id, estimate: 3 },
      { identifier: `${blockedTeam.key}-3`, number: 3, title: 'Canceled', teamId: blockedTeam.id, reporterId: owner.id, status: 'canceled', cycleId: sampleCycle.id, estimate: 8 },
    ]).returning();
    const firstSnapshots = await captureCurrentCycleSnapshots(db, sampleAt);
    const firstSnapshot = firstSnapshots.find(snapshot => snapshot.cycleId === sampleCycle.id);
    ok(firstSnapshot, 'active sample cycle has a measured snapshot');
    equal(firstSnapshot.remainingIssueCount, 1); equal(firstSnapshot.completedIssueCount, 1);
    equal(firstSnapshot.totalIssueCount, 2); equal(firstSnapshot.plannedEstimate, 8); equal(firstSnapshot.remainingEstimate, 5);
    equal((await captureCurrentCycleSnapshots(db, new Date(sampleAt.getTime() + 60 * 60 * 1000))).length, 0, 'same six-hour slot is replay-safe');
    await db.update(issues).set({ cycleId: null, status: 'shipped' }).where(eq(issues.id, remainingIssue.id));
    const laterSnapshots = await captureCurrentCycleSnapshots(db, new Date(sampleAt.getTime() + 7 * 60 * 60 * 1000));
    const laterSnapshot = laterSnapshots.find(snapshot => snapshot.cycleId === sampleCycle.id);
    ok(laterSnapshot, 'next six-hour bucket records a new sample');
    equal(laterSnapshot.totalIssueCount, 1); equal(laterSnapshot.completedIssueCount, 1);
    const savedSnapshots = await db.select().from(cycleSnapshots).where(eq(cycleSnapshots.cycleId, sampleCycle.id));
    equal(savedSnapshots.length, 2);
    ok(savedSnapshots.some(snapshot => snapshot.remainingIssueCount === 1), 'previous measured remaining count survives moving an issue out of the cycle');
    equal((await db.select().from(cycleSnapshots).where(eq(cycleSnapshots.cycleId, blockedCycle.id))).length, 0);
    await postgres.reopen();
    equal((await postgres.db.select().from(cycleSnapshots).where(eq(cycleSnapshots.cycleId, sampleCycle.id))).length, 2);
    equal((await postgres.db.select().from(issues).where(eq(issues.id, completedIssue.id))).length, 1);
    equal((await postgres.db.select().from(issues).where(eq(issues.id, canceledIssue.id))).length, 1);
  } finally { await postgres.close(); }
});
