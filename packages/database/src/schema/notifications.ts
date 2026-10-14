import { pgTable, text, timestamp, uuid, varchar, boolean, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 64 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  link: text('link'),
  read: boolean('read').notNull().default(false),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('notifications_webhook_delivery_unique_idx')
  .on(t.userId, t.type, sql`(${t.metadata}->>'webhookEventId')`, sql`(${t.metadata}->>'issueId')`)
  .where(sql`${t.metadata}->>'webhookEventId' IS NOT NULL AND ${t.metadata}->>'issueId' IS NOT NULL`)]);
