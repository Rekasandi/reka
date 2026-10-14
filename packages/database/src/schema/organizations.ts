import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, varchar, primaryKey, boolean, index, check } from 'drizzle-orm/pg-core';
import { users } from './users';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  logoUrl: text('logo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMembers = pgTable(
  'organization_members',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 32 }).notNull().default('member'),
    isActive: boolean('is_active').notNull().default(true),
    // Existing records are approved legacy accounts. New manually added
    // profiles stay pending until verified invitation acceptance.
    admission: varchar('admission', { length: 16 }).notNull().default('legacy'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.userId] }),
    check('organization_members_admission_check', sql`${t.admission} IN ('legacy', 'pending', 'invited')`),
    check('organization_members_pending_check', sql`NOT (${t.admission} = 'pending' AND ${t.isActive})`),
  ],
);

export const workspaceInvitations = pgTable('workspace_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 32 }).notNull().default('member'),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  invitedById: uuid('invited_by_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptedById: uuid('accepted_by_id').references(() => users.id, { onDelete: 'set null' }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('workspace_invitations_organization_email_idx').on(t.organizationId, t.email),
  check('workspace_invitations_role_check', sql`${t.role} IN ('admin', 'member')`),
  check('workspace_invitations_email_check', sql`${t.email} = lower(trim(${t.email}))`),
]);
