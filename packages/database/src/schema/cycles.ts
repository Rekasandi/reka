import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, varchar, integer, boolean, date, check, uniqueIndex } from 'drizzle-orm/pg-core';
import { teams } from './teams';
import { users } from './users';

export const teamCycleSettings = pgTable('team_cycle_settings', {
  teamId: uuid('team_id').primaryKey().references(() => teams.id, { onDelete: 'cascade' }),
  timezone: varchar('timezone', { length: 80 }).notNull().default('UTC'),
  durationDays: integer('duration_days').notNull().default(14),
  cooldownDays: integer('cooldown_days').notNull().default(0),
  nextStartDate: date('next_start_date', { mode: 'string' }).notNull(),
  autoCreate: boolean('auto_create').notNull().default(false),
  updatedBy: uuid('updated_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('team_cycle_settings_duration_check', sql`${t.durationDays} BETWEEN 1 AND 90`),
  check('team_cycle_settings_cooldown_check', sql`${t.cooldownDays} BETWEEN 0 AND 90`),
]);

export const cycles = pgTable('cycles', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  name: varchar('name', { length: 255 }),
  description: text('description'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  isCompleted: boolean('is_completed').notNull().default(false),
  capacity: integer('capacity'),
  scheduledStartDate: date('scheduled_start_date', { mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('cycles_date_range_check', sql`${t.startDate} < ${t.endDate}`),
  check('cycles_capacity_check', sql`${t.capacity} IS NULL OR ${t.capacity} >= 0`),
  uniqueIndex('cycles_team_scheduled_start_unique').on(t.teamId, t.scheduledStartDate).where(sql`${t.scheduledStartDate} IS NOT NULL`),
]);

export const cycleSnapshots = pgTable('cycle_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  cycleId: uuid('cycle_id').notNull().references(() => cycles.id, { onDelete: 'cascade' }),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull(),
  totalIssueCount: integer('total_issue_count').notNull(),
  completedIssueCount: integer('completed_issue_count').notNull(),
  remainingIssueCount: integer('remaining_issue_count').notNull(),
  plannedEstimate: integer('planned_estimate').notNull(),
  completedEstimate: integer('completed_estimate').notNull(),
  remainingEstimate: integer('remaining_estimate').notNull(),
  missingEstimateCount: integer('missing_estimate_count').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('cycle_snapshots_cycle_at_unique').on(t.cycleId, t.snapshotAt),
]);
