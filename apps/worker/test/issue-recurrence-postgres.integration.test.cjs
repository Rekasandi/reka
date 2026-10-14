const { equal, ok } = require('node:assert/strict');
const { test } = require('node:test');
const { and, eq, notInArray } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamWorkflowStates, issues, labels, issueLabels, issueRecurrences, issueRecurrenceRuns, issueHistory, activities } = require('@reka/database');
const { createPersistentPostgres } = require('../../api/test/support/persistent-postgres.cjs');
const { processDueIssueRecurrences } = require('../dist/processors/issue-recurrence');

test('recurring issues generate once per due occurrence, respect timezone cadence, and survive restart', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  try {
    const db = postgres.db;
    const [org] = await db.insert(organizations).values({ name: 'Recurring company', slug: 'recurring-company' }).returning();
    const [actor] = await db.insert(users).values({ name: 'Recurrence owner', email: 'recurrence@example.test' }).returning();
    await db.insert(organizationMembers).values({ organizationId: org.id, userId: actor.id, role: 'owner' });
    const [team] = await db.insert(teams).values({ organizationId: org.id, name: 'Recurring team', key: 'RCR', issueCounter: 2 }).returning();
    await db.insert(teamWorkflowStates).values({ teamId: team.id, key: 'todo', name: 'Todo', category: 'unstarted', color: '#b0b0b0', position: 0 });
    const [label] = await db.insert(labels).values({ organizationId: org.id, teamId: team.id, name: 'Repeat', color: '#123456' }).returning();
    const [source, futureSource] = await db.insert(issues).values([
      { identifier: 'RCR-1', number: 1, title: 'Recurring task', teamId: team.id, reporterId: actor.id, status: 'todo', estimate: 3 },
      { identifier: 'RCR-2', number: 2, title: 'Not due yet', teamId: team.id, reporterId: actor.id, status: 'todo' },
    ]).returning();
    await db.insert(issueLabels).values({ issueId: source.id, labelId: label.id });
    const scheduledFor = new Date('2026-03-08T06:30:00.000Z');
    const [recurrence, futureRecurrence] = await db.insert(issueRecurrences).values([
      { sourceIssueId: source.id, teamId: team.id, createdBy: actor.id, intervalCount: 1, unit: 'day', timezone: 'America/New_York', nextRunAt: scheduledFor,
        template: { title: 'Recurring task', description: null, status: 'todo', priority: 'no_priority', type: 'task', projectId: null, cycleId: null, assigneeId: null, parentId: null, estimate: 3, labelIds: [label.id], dueDateOffsetDays: 2 } },
      { sourceIssueId: futureSource.id, teamId: team.id, createdBy: actor.id, intervalCount: 1, unit: 'week', timezone: 'UTC', nextRunAt: new Date('2026-03-09T00:00:00Z'),
        template: { title: 'Not due yet', description: null, status: 'todo', priority: 'no_priority', type: 'task', projectId: null, cycleId: null, assigneeId: null, parentId: null, estimate: null, labelIds: [], dueDateOffsetDays: null } },
    ]).returning();

    const now = new Date('2026-03-08T07:30:00.000Z'); // 03:30 after the New York spring-forward transition.
    const first = await processDueIssueRecurrences(db, now);
    equal(first.length, 1);
    equal(first[0].recurrenceId, recurrence.id);
    equal(first[0].scheduledFor.toISOString(), scheduledFor.toISOString());
    equal((await processDueIssueRecurrences(db, now)).length, 0, 'replay does not create another issue for the completed occurrence');

    await postgres.reopen();
    const generated = await postgres.db.select().from(issues).where(and(eq(issues.teamId, team.id), notInArray(issues.id, [source.id, futureSource.id])));
    equal(generated.length, 1);
    equal(generated[0].identifier, 'RCR-3');
    equal(generated[0].estimate, 3);
    equal(new Date(generated[0].dueDate).toISOString(), '2026-03-10T04:00:00.000Z', 'due-date offsets follow local calendar days over DST');
    equal((await postgres.db.select().from(issueLabels).where(eq(issueLabels.issueId, generated[0].id))).length, 1);
    const [savedRecurrence] = await postgres.db.select().from(issueRecurrences).where(eq(issueRecurrences.id, recurrence.id));
    equal(savedRecurrence.nextRunAt.toISOString(), '2026-03-09T05:30:00.000Z', 'next daily occurrence remains at 01:30 local time after DST');
    equal((await postgres.db.select().from(issueRecurrenceRuns).where(eq(issueRecurrenceRuns.recurrenceId, recurrence.id))).length, 1);
    ok((await postgres.db.select().from(issueHistory).where(eq(issueHistory.issueId, generated[0].id))).some((event) => event.event === 'created'));
    ok((await postgres.db.select().from(activities).where(eq(activities.issueId, generated[0].id))).some((event) => event.type === 'issue.recurring_created'));
    equal((await postgres.db.select().from(issueRecurrenceRuns).where(eq(issueRecurrenceRuns.recurrenceId, futureRecurrence.id))).length, 0, 'future work remains untouched');
  } finally {
    await postgres.close();
  }
});
