import { pgTable, text, timestamp, uuid, varchar, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

// Authentication tables follow Better Auth's core model (user/session/account/verification), mapped onto
// REKA's existing names. Better Auth owns writes to sessions/accounts/verifications; the app reads them.
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  githubUsername: varchar('github_username', { length: 255 }),
  githubId: varchar('github_id', { length: 64 }).unique(),
  /** Legacy copy of a workspace role; membership rows are authoritative. */
  role: varchar('role', { length: 32 }).notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  /** The workspace this session is working in (Better Auth organization plugin). */
  activeOrganizationId: uuid('active_organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('sessions_user_id_idx').on(t.userId)]);

/** Credential (hashed password) and OAuth accounts linked to a user. */
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('accounts_user_id_idx').on(t.userId), uniqueIndex('accounts_provider_account_unique').on(t.providerId, t.accountId)]);

/** Email verification, password reset and magic-link tokens. */
export const verifications = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('verifications_identifier_idx').on(t.identifier)]);

/** One-use browser-bound nonces for the GitHub App installation handoff (not used for sign-in any more). */
export const oauthLoginAttempts = pgTable('oauth_login_attempts', {
  stateHash: varchar('state_hash', { length: 64 }).primaryKey(),
  invitationHash: varchar('invitation_hash', { length: 64 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => [index('oauth_login_attempts_expiry_idx').on(t.expiresAt)]);
