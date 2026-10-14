import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { teams } from './teams';
import { users } from './users';

export type SavedIssueViewConfig = {
  filterTab: 'all' | 'active' | 'backlog' | 'done' | 'archived';
  viewMode: 'grouped' | 'list' | 'board';
  groupBy: 'status' | 'none';
  sortBy: 'manual' | 'updated' | 'priority' | 'dueDate';
  showSubtasks: boolean;
  filters: { assigneeIds: string[]; labelIds: string[]; priorities: string[]; projectIds: string[] };
};

export const savedViews = pgTable('saved_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 80 }).notNull(),
  visibility: varchar('visibility', { length: 12 }).notNull().default('private'),
  config: jsonb('config').$type<SavedIssueViewConfig>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('saved_views_org_team_visibility_idx').on(t.organizationId, t.teamId, t.visibility),
  check('saved_views_visibility_check', sql`${t.visibility} IN ('private', 'shared')`),
]);

export const userFavorites = pgTable('user_favorites', {
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  resourceType: varchar('resource_type', { length: 16 }).notNull(),
  resourceId: uuid('resource_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.organizationId, t.userId, t.resourceType, t.resourceId] }),
  index('user_favorites_owner_idx').on(t.organizationId, t.userId, t.createdAt),
  check('user_favorites_resource_type_check', sql`${t.resourceType} IN ('issue', 'project', 'view', 'document')`),
]);
