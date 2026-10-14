import { pgTable, text, timestamp, uuid, varchar, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { issues } from './issues';
import { projects } from './projects';

export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 64 }).notNull(), // e.g. 'issue.status_changed', 'issue.comment_created'
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('github_activity_webhook_event_unique_idx')
    .on(t.issueId, t.type, sql`(${t.metadata}->>'webhookEventId')`)
    .where(sql`${t.type} in ('github.pr_opened', 'github.pr_merged') and ${t.metadata} ? 'webhookEventId'`),
  uniqueIndex('github_activity_webhook_delivery_per_issue_unique_idx')
    .on(t.issueId, sql`(${t.metadata}->>'webhookEventId')`)
    .where(sql`${t.type} like 'github.%' and ${t.metadata} ? 'webhookEventId'`),
]);
