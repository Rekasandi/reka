import { pgTable, uuid, varchar, integer, boolean, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { issues } from './issues';
import { teams } from './teams';
import { users } from './users';

export interface RecurringIssueTemplate {
  title: string;
  description: string | null;
  status: string;
  priority: string;
  type: string;
  projectId: string | null;
  cycleId: string | null;
  assigneeId: string | null;
  parentId: string | null;
  estimate: number | null;
  labelIds: string[];
  dueDateOffsetDays: number | null;
}

export const issueRecurrences = pgTable('issue_recurrences', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceIssueId: uuid('source_issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  intervalCount: integer('interval_count').notNull().default(1),
  unit: varchar('unit', { length: 16 }).notNull(),
  timezone: varchar('timezone', { length: 64 }).notNull(),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  template: jsonb('template').$type<RecurringIssueTemplate>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('issue_recurrences_source_issue_unique_idx').on(t.sourceIssueId),
  index('issue_recurrences_due_idx').on(t.enabled, t.nextRunAt),
]);

export const issueRecurrenceRuns = pgTable('issue_recurrence_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  recurrenceId: uuid('recurrence_id').notNull().references(() => issueRecurrences.id, { onDelete: 'cascade' }),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
  issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('issue_recurrence_runs_schedule_unique_idx').on(t.recurrenceId, t.scheduledFor),
  index('issue_recurrence_runs_issue_idx').on(t.issueId),
]);
