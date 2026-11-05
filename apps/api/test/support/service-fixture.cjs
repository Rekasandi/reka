const { organizations, organizationMembers, users, teams, teamMembers, projects, projectMembers, issues } = require('@reka/database');
const { createPersistentPostgres } = require('./persistent-postgres.cjs');
const { NotificationsService } = require('../../dist/notifications/notifications.service');
const { IssuesService } = require('../../dist/issues/issues.service');
const { CommentsService } = require('../../dist/comments/comments.service');
const { TeamsService } = require('../../dist/teams/teams.service');
const { ProjectsService } = require('../../dist/projects/projects.service');

// Existing domain regression tests now exercise real SQL authorization instead
// of partial fake query builders that silently ignored joins/where conditions.
async function createServiceFixture() {
  const postgres = await createPersistentPostgres();
  try {
    const db = postgres.db;
    const [org] = await db.insert(organizations).values({ name: 'Internal test company', slug: 'test-company' }).returning();
    const [actor, assignee, reporter, mentioned] = await db.insert(users).values([
      { email: 'actor@example.test', name: 'Actor' },
      { email: 'assignee@example.test', name: 'Assignee' },
      { email: 'reporter@example.test', name: 'Reporter' },
      { email: 'pat@example.test', name: 'Pat Person', githubUsername: 'pat-dev' },
    ]).returning();
    await db.insert(organizationMembers).values([
      { organizationId: org.id, userId: actor.id, role: 'owner' },
      { organizationId: org.id, userId: assignee.id, role: 'member' },
      { organizationId: org.id, userId: reporter.id, role: 'member' },
      { organizationId: org.id, userId: mentioned.id, role: 'member' },
    ]);
    const [team] = await db.insert(teams).values({ organizationId: org.id, name: 'Engineering', key: 'ENG' }).returning();
    await db.insert(teamMembers).values({ teamId: team.id, userId: actor.id, role: 'lead' });
    const [project] = await db.insert(projects).values({ organizationId: org.id, teamId: team.id, ownerId: actor.id, name: 'Workspace', slug: 'workspace' }).returning();
    await db.insert(projectMembers).values({ projectId: project.id, userId: actor.id, role: 'owner' });
    const [issue] = await db.insert(issues).values({ teamId: team.id, projectId: project.id, reporterId: reporter.id, assigneeId: assignee.id, identifier: 'ENG-1', number: 1, title: 'Actual task', status: 'todo', priority: 'high' }).returning();
    const database = { get db() { return postgres.db; } };
    const inbox = new NotificationsService(database);
    return {
      postgres, database, get db() { return postgres.db; }, org, actor, assignee, reporter, mentioned, team, project, issue, inbox,
      issues: new IssuesService(database, inbox), comments: new CommentsService(database, inbox),
      teams: new TeamsService(database, inbox), projects: new ProjectsService(database, inbox),
      close: () => postgres.close(),
    };
  } catch (error) {
    await postgres.close();
    throw error;
  }
}
module.exports = { createServiceFixture };
