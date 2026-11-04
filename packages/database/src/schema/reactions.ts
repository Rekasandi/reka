import { sql } from 'drizzle-orm';
import { check, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { comments } from './comments';
import { issues } from './issues';
import { users } from './users';

/** Emoji reaction on an issue or a comment (exactly one target). One row per user, target and emoji. */
export const reactions = pgTable('reactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'cascade' }),
  commentId: uuid('comment_id').references(() => comments.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  emoji: varchar('emoji', { length: 16 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('reactions_single_target_check', sql`(${t.issueId} IS NOT NULL) <> (${t.commentId} IS NOT NULL)`),
  uniqueIndex('reactions_issue_user_emoji_unique').on(t.issueId, t.userId, t.emoji).where(sql`${t.issueId} IS NOT NULL`),
  uniqueIndex('reactions_comment_user_emoji_unique').on(t.commentId, t.userId, t.emoji).where(sql`${t.commentId} IS NOT NULL`),
]);
