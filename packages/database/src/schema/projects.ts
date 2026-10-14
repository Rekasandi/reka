import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, timestamp, uuid, varchar, integer, primaryKey } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { teams } from './teams';
import { clients } from './clients';
import { users } from './users';

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  icon: varchar('icon', { length: 64 }),
  slug: varchar('slug', { length: 100 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 32 }).notNull().default('planned'),
  health: varchar('health', { length: 32 }).notNull().default('on_track'),
  priority: varchar('priority', { length: 32 }).notNull().default('medium'),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  startDate: timestamp('start_date', { withTimezone: true }),
  targetDate: timestamp('target_date', { withTimezone: true }),
  budget: integer('budget'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const initiatives = pgTable('initiatives', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 180 }).notNull(),
  description: text('description').notNull().default(''),
  status: varchar('status', { length: 24 }).notNull().default('planned'),
  health: varchar('health', { length: 24 }).notNull().default('on_track'),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  startDate: timestamp('start_date', { withTimezone: true }),
  targetDate: timestamp('target_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('initiatives_org_updated_idx').on(t.organizationId, t.updatedAt),
  check('initiatives_status_check', sql`${t.status} IN ('planned', 'in_progress', 'completed', 'canceled')`),
  check('initiatives_health_check', sql`${t.health} IN ('on_track', 'at_risk', 'off_track')`),
  check('initiatives_date_range_check', sql`${t.startDate} IS NULL OR ${t.targetDate} IS NULL OR ${t.startDate} <= ${t.targetDate}`),
]);

export const initiativeProjects = pgTable('initiative_projects', {
  initiativeId: uuid('initiative_id').notNull().references(() => initiatives.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.initiativeId, t.projectId] }),
  index('initiative_projects_project_idx').on(t.projectId, t.initiativeId),
]);

export const milestones = pgTable('milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  targetDate: timestamp('target_date', { withTimezone: true }),
  isCompleted: boolean('is_completed').notNull().default(false),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('milestones_project_order_idx').on(t.projectId, t.position, t.createdAt)]);

export const projectDependencies = pgTable('project_dependencies', {
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  dependsOnProjectId: uuid('depends_on_project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.projectId, t.dependsOnProjectId] }),
  check('project_dependencies_no_self_check', sql`${t.projectId} <> ${t.dependsOnProjectId}`),
]);

export const projectUpdates = pgTable('project_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  health: varchar('health', { length: 32 }).notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('project_updates_project_created_idx').on(t.projectId, t.createdAt),
  check('project_updates_health_check', sql`${t.health} IN ('on_track', 'at_risk', 'off_track')`),
]);

export const projectUpdateSubscriptions = pgTable('project_update_subscriptions', {
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.projectId, t.userId] })]);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 180 }).notNull(),
  content: text('content').notNull().default(''),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  updatedBy: uuid('updated_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('documents_org_project_updated_idx').on(t.organizationId, t.projectId, t.updatedAt),
  index('documents_org_team_updated_idx').on(t.organizationId, t.teamId, t.updatedAt),
  check('documents_single_team_or_project_check', sql`${t.teamId} IS NULL OR ${t.projectId} IS NULL`),
]);

export const projectMembers = pgTable(
  'project_members',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 32 }).notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);
