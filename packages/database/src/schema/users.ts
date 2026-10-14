import { pgTable, text, timestamp, uuid, varchar, integer, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  githubUsername: varchar('github_username', { length: 255 }),
  githubId: varchar('github_id', { length: 64 }).unique(),
  role: varchar('role', { length: 32 }).notNull().default('member'), // 'owner' | 'admin' | 'member' | 'guest' | 'client'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// One-use browser-bound OAuth nonce. Neither raw state nor invitation secrets
// are stored. Legacy GitHub usernames are not guessed into stable identities.
export const oauthLoginAttempts = pgTable('oauth_login_attempts', {
  stateHash: varchar('state_hash', { length: 64 }).primaryKey(),
  invitationHash: varchar('invitation_hash', { length: 64 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => [index('oauth_login_attempts_expiry_idx').on(t.expiresAt)]);

export const userCredentials = pgTable('user_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  transports: text('transports').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
