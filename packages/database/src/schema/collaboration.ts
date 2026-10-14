import { jsonb, pgTable, primaryKey, timestamp, uuid, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { issues } from './issues';
import { users } from './users';

export interface NotificationPreferenceValues {
  comments: boolean;
  mentions: boolean;
  assignments: boolean;
  issueUpdates: boolean;
  projectUpdates: boolean;
  github: boolean;
  teamInvites: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceValues = {
  comments: true, mentions: true, assignments: true, issueUpdates: true,
  projectUpdates: true, github: true, teamInvites: true,
};

export const issueSubscriptions = pgTable('issue_subscriptions', {
  issueId: uuid('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.issueId, t.userId], name: 'issue_subscriptions_pk' })]);

export const notificationPreferences = pgTable('notification_preferences', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  preferences: jsonb('preferences').$type<NotificationPreferenceValues>().notNull().default(DEFAULT_NOTIFICATION_PREFERENCES),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check('notification_preferences_object_check', sql`jsonb_typeof(${t.preferences}) = 'object'`)]);
