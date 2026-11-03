import { sql } from 'drizzle-orm';
import { check, index, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

export const userFavorites = pgTable('user_favorites', {
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  resourceType: varchar('resource_type', { length: 16 }).notNull(),
  resourceId: uuid('resource_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.organizationId, t.userId, t.resourceType, t.resourceId] }),
  index('user_favorites_owner_idx').on(t.organizationId, t.userId, t.createdAt),
  check('user_favorites_resource_type_check', sql`${t.resourceType} IN ('issue', 'project', 'document')`),
]);
