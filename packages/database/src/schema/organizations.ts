import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, varchar, primaryKey, boolean, index, check } from 'drizzle-orm/pg-core';
import { users } from './users';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  logoUrl: text('logo_url'),
  /** Better Auth organization metadata (JSON string); unused by REKA itself. */
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMembers = pgTable(
  'organization_members',
  {
    /** Row id for Better Auth's member model; (organizationId, userId) stays the primary key. */
    id: uuid('id').notNull().defaultRandom().unique(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 32 }).notNull().default('member'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.userId] }),
  ],
);

export const workspaceInvitations = pgTable('workspace_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 32 }).notNull().default('member'),
  /** pending | accepted | rejected | canceled (Better Auth organization invitations). */
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  invitedById: uuid('invited_by_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('workspace_invitations_organization_email_idx').on(t.organizationId, t.email),
  check('workspace_invitations_role_check', sql`${t.role} IN ('admin', 'member', 'guest', 'client')`),
  check('workspace_invitations_status_check', sql`${t.status} IN ('pending', 'accepted', 'rejected', 'canceled')`),
  check('workspace_invitations_email_check', sql`${t.email} = lower(trim(${t.email}))`),
]);
