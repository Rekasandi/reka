import { pgTable, text, timestamp, uuid, varchar, integer, boolean, jsonb, bigint, primaryKey } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { projects } from './projects';
import { issues } from './issues';

export const githubInstallations = pgTable('github_installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  installationId: bigint('installation_id', { mode: 'number' }).notNull().unique(),
  accountLogin: varchar('account_login', { length: 255 }).notNull(),
  accountType: varchar('account_type', { length: 32 }).notNull().default('Organization'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const githubRepositories = pgTable('github_repositories', {
  id: uuid('id').primaryKey().defaultRandom(),
  installationId: uuid('installation_id')
    .notNull()
    .references(() => githubInstallations.id, { onDelete: 'cascade' }),
  repoId: bigint('repo_id', { mode: 'number' }).notNull().unique(),
  owner: varchar('owner', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 512 }).notNull(),
  isPrivate: boolean('is_private').notNull().default(false),
  defaultBranch: varchar('default_branch', { length: 100 }).notNull().default('main'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projectRepositories = pgTable(
  'project_repositories',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => githubRepositories.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.repositoryId] })],
);

export const githubBranches = pgTable('github_branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  repositoryId: uuid('repository_id')
    .notNull()
    .references(() => githubRepositories.id, { onDelete: 'cascade' }),
  issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  sha: varchar('sha', { length: 40 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const githubPullRequests = pgTable('github_pull_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  repositoryId: uuid('repository_id')
    .notNull()
    .references(() => githubRepositories.id, { onDelete: 'cascade' }),
  issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'set null' }),
  prNumber: integer('pr_number').notNull(),
  title: varchar('title', { length: 512 }).notNull(),
  state: varchar('state', { length: 32 }).notNull().default('open'),
  merged: boolean('merged').notNull().default(false),
  branchName: varchar('branch_name', { length: 255 }).notNull(),
  htmlUrl: text('html_url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: varchar('provider', { length: 32 }).notNull().default('github'),
  deliveryId: varchar('delivery_id', { length: 128 }).notNull().unique(),
  event: varchar('event', { length: 64 }).notNull(),
  payload: jsonb('payload').notNull(),
  processed: boolean('processed').notNull().default(false),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
