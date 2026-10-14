const { deepEqual, equal, ok } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { and, eq, or, sql } = require('drizzle-orm');
const {
  activities,
  issues,
  notifications,
  organizations,
  organizationMembers,
  projects,
  teams,
  users,
} = require('@reka/database');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { NotificationsService } = require('../dist/notifications/notifications.service');
const { IssuesService } = require('../dist/issues/issues.service');
const { CommentsService } = require('../dist/comments/comments.service');
const { TeamsService } = require('../dist/teams/teams.service');
const { ProjectsService } = require('../dist/projects/projects.service');

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

test('Postgres event integration persists recipients across database process reloads', { timeout: 90_000 }, async () => {
  const postgres = await createPersistentPostgres();
  const marker = randomUUID().replaceAll('-', '').slice(0, 10).toLowerCase();

  try {
    const db = postgres.db;
    const [org] = await db.insert(organizations).values({ name: `Integration ${marker}`, slug: `integration-${marker}` }).returning();
    const [actor] = await db.insert(users).values({ email: `actor-${marker}@example.test`, name: 'Actor User' }).returning();
    const [recipient] = await db.insert(users).values({ email: `recipient-${marker}@example.test`, name: 'Recipient User' }).returning();
    ok(org && actor && recipient);
    await db.insert(organizationMembers).values([
      { organizationId: org.id, userId: actor.id, role: 'owner' },
      { organizationId: org.id, userId: recipient.id, role: 'member' },
    ]);

    const api = services(db);
    const team = await api.teams.create({ name: `Integration ${marker}`, key: `T${marker.slice(0, 8)}` }, actor.id);
    await api.teams.addMember(team.id, { userId: recipient.id, role: 'member' }, actor.id);
    const project = await api.projects.create({ teamId: team.id, name: `Integration ${marker}`, slug: `integration-${marker}` }, actor.id);
    await api.projects.addMember(project.id, recipient.id, actor.id);
    const duplicateInvite = await api.projects.addMember(project.id, recipient.id, actor.id);
    equal(duplicateInvite.added, false);

    const [issue] = await db.insert(issues).values({
      identifier: `${team.key}-${marker}`,
      number: 1,
      title: `Integration ${marker}`,
      status: 'todo',
      type: 'task',
      teamId: team.id,
      projectId: project.id,
      reporterId: actor.id,
      assigneeId: actor.id,
    }).returning();

    await api.issues.update(issue.id, { assigneeId: recipient.id, status: 'in_progress' }, actor.id);
    await api.issues.update(issue.id, { assigneeId: recipient.id, status: 'in_progress' }, actor.id);
    await api.comments.create(issue.id, `A real comment ${marker}`, actor.id);
    await api.comments.create(issue.id, `Please review @${recipient.email.split('@')[0]}`, actor.id);

    await postgres.reopen();
    const afterRestart = services(postgres.db);
    const received = (await afterRestart.inbox.findAll(recipient.id, { limit: 500 })).filter((row) =>
      row.metadata.issueId === issue.id || row.metadata.teamId === team.id || row.metadata.projectId === project.id,
    );
    deepEqual(received.map((row) => row.type).sort(), [
      'assignment', 'comment', 'mention', 'project_invite', 'status_change', 'team_invite',
    ].sort());
    equal(new Set(received.map((row) => row.id)).size, 6, 'no-op updates and invite retries must not duplicate notifications');

    const persistedRecipients = await postgres.db.select({ userId: notifications.userId }).from(notifications).where(or(
      sql`${notifications.metadata}->>'issueId' = ${issue.id}`,
      sql`${notifications.metadata}->>'teamId' = ${team.id}`,
      sql`${notifications.metadata}->>'projectId' = ${project.id}`,
    ));
    deepEqual([...new Set(persistedRecipients.map((row) => row.userId))], [recipient.id]);

    const assignment = received.find((row) => row.type === 'assignment');
    await afterRestart.inbox.markAsRead(assignment.id, recipient.id);
    await postgres.reopen();
    const afterReadRestart = new NotificationsService({ db: postgres.db });
    equal((await afterReadRestart.findAll(recipient.id, { read: true, limit: 500 })).some((row) => row.id === assignment.id), true);
    await afterReadRestart.delete(assignment.id, recipient.id);
    await postgres.reopen();
    const afterDeleteRestart = new NotificationsService({ db: postgres.db });
    equal((await afterDeleteRestart.findAll(recipient.id, { limit: 500 })).some((row) => row.id === assignment.id), false);
  } finally {
    await postgres.close();
  }
});
