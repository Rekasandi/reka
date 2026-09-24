import { relations } from 'drizzle-orm';
import { users, userCredentials, sessions } from './users';
import { organizations, organizationMembers } from './organizations';
import { teams, teamMembers } from './teams';
import { clients, clientContacts } from './clients';
import { projects, projectMembers } from './projects';
import { issues, issueLabels, issueRelations } from './issues';
import { labels } from './labels';
import { comments, attachments } from './comments';
import { milestones } from './milestones';
import { cycles } from './cycles';
import { activities } from './activities';
import { notifications } from './notifications';
import {
  githubInstallations,
  githubRepositories,
  projectRepositories,
  githubPullRequests,
  githubBranches,
} from './github';

export const usersRelations = relations(users, ({ many }) => ({
  credentials: many(userCredentials),
  sessions: many(sessions),
  organizationMemberships: many(organizationMembers),
  teamMemberships: many(teamMembers),
  projectMemberships: many(projectMembers),
  assignedIssues: many(issues, { relationName: 'assignee' }),
  reportedIssues: many(issues, { relationName: 'reporter' }),
  comments: many(comments),
  notifications: many(notifications),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  teams: many(teams),
  clients: many(clients),
  projects: many(projects),
  labels: many(labels),
  githubInstallations: many(githubInstallations),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  members: many(teamMembers),
  projects: many(projects),
  issues: many(issues),
  cycles: many(cycles),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [clients.organizationId],
    references: [organizations.id],
  }),
  contacts: many(clientContacts),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
  }),
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  members: many(projectMembers),
  milestones: many(milestones),
  issues: many(issues),
  repositories: many(projectRepositories),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  team: one(teams, {
    fields: [issues.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [issues.projectId],
    references: [projects.id],
  }),
  cycle: one(cycles, {
    fields: [issues.cycleId],
    references: [cycles.id],
  }),
  milestone: one(milestones, {
    fields: [issues.milestoneId],
    references: [milestones.id],
  }),
  assignee: one(users, {
    fields: [issues.assigneeId],
    references: [users.id],
    relationName: 'assignee',
  }),
  reporter: one(users, {
    fields: [issues.reporterId],
    references: [users.id],
    relationName: 'reporter',
  }),
  labels: many(issueLabels),
  comments: many(comments),
  attachments: many(attachments),
  pullRequests: many(githubPullRequests),
  branches: many(githubBranches),
  activities: many(activities),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  issue: one(issues, {
    fields: [comments.issueId],
    references: [issues.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));
