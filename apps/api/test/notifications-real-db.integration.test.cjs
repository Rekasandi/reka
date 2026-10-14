const { deepEqual, equal, ok } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
require('dotenv').config({ path: resolve(__dirname, '../../../.env') });

const databaseUrl = process.env.DATABASE_URL;
const runDbWriteTests = process.env.REKA_RUN_DB_INTEGRATION === '1';
const { and, eq, or, sql } = require('drizzle-orm');
const {
  createDbClient,
  activities,
  issues,
  notifications,
  organizations,
  projects,
  teams,
  users,
} = require('@reka/database');
const { NotificationsService } = require('../dist/notifications/notifications.service');
const { IssuesService } = require('../dist/issues/issues.service');
const { CommentsService } = require('../dist/comments/comments.service');
const { TeamsService } = require('../dist/teams/teams.service');
const { ProjectsService } = require('../dist/projects/projects.service');

const legacyTitles = new Set([
  'PR #142 Merged: Add optimistic UI updates for Kanban board',
  'Sarah Jenkins mentioned you on RS-58',
  'Assigned to RS-64: High-velocity triage inbox',
  'Alex Morgan requested your review on PR #149',
  'RS-49 moved to In Review',
  'Cycle 12 ends in 2 days',
  'Alex Morgan mentioned you on RS-104',
  'PR #182 Merged: Enhance issue query pagination',
]);

function services(db) {
  const database = { db };
  const inbox = new NotificationsService(database);
  return {
    inbox,
    issues: new IssuesService(database, inbox),
    comments: new CommentsService(database, inbox),
    teams: new TeamsService(database, inbox),
    projects: new ProjectsService(database, inbox),
  };
}

test('live database Inbox audit: every stored row has supported event provenance', {
  skip: !databaseUrl && 'DATABASE_URL is not configured',
  timeout: 60_000,
}, async () => {
  const db = createDbClient(databaseUrl);
  const [rows, issueRows, teamRows, projectRows] = await Promise.all([
    db.select().from(notifications),
    db.select({ id: issues.id, identifier: issues.identifier }).from(issues),
    db.select({ id: teams.id, name: teams.name }).from(teams),
    db.select({ id: projects.id, name: projects.name }).from(projects),
  ]);
  const issuesById = new Map(issueRows.map((row) => [row.id, row]));
  const teamsById = new Map(teamRows.map((row) => [row.id, row]));
  const projectsById = new Map(projectRows.map((row) => [row.id, row]));
  const counts = {};

  for (const row of rows) {
    counts[row.type] = (counts[row.type] || 0) + 1;
    ok(!legacyTitles.has(row.title), `legacy fixture title remains: ${row.type}`);
    ok(row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata));

    if (['assignment', 'comment', 'mention', 'status_change', 'pr_merged'].includes(row.type)) {
      const issue = issuesById.get(row.metadata.issueId);
      ok(issue, `issue provenance missing for ${row.type}`);
      equal(row.metadata.issueIdentifier, issue.identifier);
      if (row.metadata.webhookEventId) {
        ok(row.metadata.prNumber, 'GitHub PR notification lacks pull request provenance');
      }
      continue;
    }
    if (row.type === 'team_invite') {
      ok(teamsById.has(row.metadata.teamId), 'team invite references a missing team');
      continue;
    }
    if (row.type === 'project_invite') {
      ok(projectsById.has(row.metadata.projectId), 'project invite references a missing project');
      continue;
    }
    throw new Error(`Unsupported notification event type in database: ${row.type}`);
  }

  console.log(`Live Inbox audit passed: ${rows.length} rows; ${JSON.stringify(counts)}`);
});

test('real event services persist correct Inbox recipients across fresh database clients', {
  skip: !databaseUrl ? 'DATABASE_URL is not configured' : !runDbWriteTests && 'Set REKA_RUN_DB_INTEGRATION=1 to run write tests',
  timeout: 90_000,
}, async () => {
  const db = createDbClient(databaseUrl);
  const fixtures = { teamId: null, projectId: null, issueId: null, targetId: null };
  const marker = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
  let target;

  try {
    const [org] = await db.select().from(organizations).limit(1);
    const people = await db.select().from(users).limit(2);
    ok(org, 'test requires an existing organization');
    equal(people.length, 2, 'test requires two real users to verify recipient isolation');
    const [actor, recipient] = people;
    target = recipient;
    fixtures.targetId = recipient.id;

    const api = services(db);
    const team = await api.teams.create({ name: `Inbox integration ${marker}`, key: `I${marker.slice(0, 8)}` }, actor.id);
    fixtures.teamId = team.id;
    await api.teams.addMember(team.id, { userId: recipient.id, role: 'member' }, actor.id);

    const project = await api.projects.create({ teamId: team.id, name: `Inbox integration ${marker}`, slug: `inbox-integration-${marker.toLowerCase()}` }, actor.id);
    fixtures.projectId = project.id;
    await api.projects.addMember(project.id, recipient.id, actor.id);
    const duplicateProjectInvite = await api.projects.addMember(project.id, recipient.id, actor.id);
    equal(duplicateProjectInvite.added, false);

    const [issue] = await db.insert(issues).values({
      identifier: `${team.key}-${Date.now()}`,
      number: Date.now() % 2_000_000_000,
      title: `Inbox integration ${marker}`,
      status: 'todo',
      type: 'task',
      teamId: team.id,
      projectId: project.id,
      reporterId: actor.id,
      assigneeId: actor.id,
    }).returning();
    fixtures.issueId = issue.id;

    await api.issues.update(issue.id, { assigneeId: recipient.id, status: 'in_progress' }, actor.id);
    await api.issues.update(issue.id, { assigneeId: recipient.id, status: 'in_progress' }, actor.id);
    await api.comments.create(issue.id, `A real comment ${marker}`, actor.id);
    await api.comments.create(issue.id, `Please review @${recipient.email.split('@')[0]}`, actor.id);

    const reloadedDb = createDbClient(databaseUrl);
    const reloadedInbox = new NotificationsService({ db: reloadedDb });
    const eventRows = (await reloadedInbox.findAll(recipient.id, { limit: 500 })).filter((row) =>
      row.metadata.issueId === issue.id || row.metadata.teamId === team.id || row.metadata.projectId === project.id,
    );
    const receivedTypes = eventRows.map((row) => row.type).sort();
    deepEqual(receivedTypes, ['assignment', 'comment', 'mention', 'project_invite', 'status_change', 'team_invite'].sort());
    equal(new Set(eventRows.map((row) => row.id)).size, eventRows.length, 'retries/no-op updates must not duplicate events');

    const allRows = await reloadedDb.select().from(notifications).where(
      or(
        sql`${notifications.metadata}->>'issueId' = ${issue.id}`,
        sql`${notifications.metadata}->>'teamId' = ${team.id}`,
        sql`${notifications.metadata}->>'projectId' = ${project.id}`,
      ),
    );
    deepEqual([...new Set(allRows.map((row) => row.userId))], [recipient.id]);

    const assignment = eventRows.find((row) => row.type === 'assignment');
    await reloadedInbox.markAsRead(assignment.id, recipient.id);
    const afterRead = new NotificationsService({ db: createDbClient(databaseUrl) });
    equal((await afterRead.findAll(recipient.id, { read: true, limit: 500 })).some((row) => row.id === assignment.id), true);
    await afterRead.delete(assignment.id, recipient.id);
    const afterDelete = new NotificationsService({ db: createDbClient(databaseUrl) });
    equal((await afterDelete.findAll(recipient.id, { limit: 500 })).some((row) => row.id === assignment.id), false);
  } finally {
    if (fixtures.targetId) {
      const cleanupDb = createDbClient(databaseUrl);
      const predicates = [];
      if (fixtures.issueId) predicates.push(sql`${notifications.metadata}->>'issueId' = ${fixtures.issueId}`);
      if (fixtures.teamId) predicates.push(sql`${notifications.metadata}->>'teamId' = ${fixtures.teamId}`);
      if (fixtures.projectId) predicates.push(sql`${notifications.metadata}->>'projectId' = ${fixtures.projectId}`);
      if (predicates.length) {
        await cleanupDb.delete(notifications).where(and(
          eq(notifications.userId, fixtures.targetId),
          or(...predicates),
        ));
      }
      if (fixtures.issueId) await cleanupDb.delete(issues).where(eq(issues.id, fixtures.issueId));
      if (fixtures.projectId) await cleanupDb.delete(projects).where(eq(projects.id, fixtures.projectId));
      if (fixtures.teamId) await cleanupDb.delete(teams).where(eq(teams.id, fixtures.teamId));
    }
  }
});
