import { sql } from 'drizzle-orm';
import { bigserial, check, index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { teams } from './teams';
import { users } from './users';

// Database triggers record every issue write, including worker/cycle changes.
// A baseline is instrumentation start, never fabricated past delivery history.
export const issueHistory = pgTable('issue_history', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  // No issue FK: retain real deletion events. Team access still scopes history.
  issueId: uuid('issue_id').notNull(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  event: varchar('event', { length: 32 }).notNull(),
  beforeState: jsonb('before_state').$type<Record<string, unknown> | null>(),
  afterState: jsonb('after_state').$type<Record<string, unknown> | null>(),
  beforeStatusCategory: varchar('before_status_category', { length: 16 }),
  afterStatusCategory: varchar('after_status_category', { length: 16 }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('issue_history_team_recorded_idx').on(t.teamId, t.recordedAt),
  index('issue_history_issue_sequence_idx').on(t.issueId, t.id),
  check('issue_history_event_check', sql`${t.event} IN ('baseline', 'created', 'updated', 'deleted')`),
]);
