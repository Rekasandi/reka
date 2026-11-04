import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, varchar, primaryKey, boolean, integer, check } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  key: varchar('key', { length: 10 }).notNull(), // e.g. "RS"
  icon: varchar('icon', { length: 64 }),
  description: text('description'),
  isPrivate: boolean('is_private').notNull().default(false),
  cyclesEnabled: boolean('cycles_enabled').notNull().default(true),
  estimatesEnabled: boolean('estimates_enabled').notNull().default(true),
  estimateScale: varchar('estimate_scale', { length: 16 }).notNull().default('fibonacci'),
  autoCloseParent: boolean('auto_close_parent').notNull().default(false),
  /** Archive completed/canceled issues untouched for this many months; null keeps them forever. */
  autoArchiveMonths: integer('auto_archive_months'),
  /** When a parent is completed or canceled, close its open sub-issues with the same category. */
  autoCloseChildren: boolean('auto_close_children').notNull().default(false),
  /** Cancel backlog/unstarted/triage issues untouched for this many months; null keeps them open. */
  autoCloseStaleMonths: integer('auto_close_stale_months'),
  triageEnabled: boolean('triage_enabled').notNull().default(true),
  /** SLA deadlines for urgent (1 day) and high (7 days) priority issues. */
  slaEnabled: boolean('sla_enabled').notNull().default(false),
  /** Workflow state keys. Null = automatic (first fitting active state). */
  defaultStatus: varchar('default_status', { length: 32 }),
  duplicateStatus: varchar('duplicate_status', { length: 32 }),
  /** GitHub PR automation targets. Null = automatic, '-' = no status change, otherwise a workflow state key. */
  githubDraftStatus: varchar('github_draft_status', { length: 32 }),
  githubOpenStatus: varchar('github_open_status', { length: 32 }),
  githubMergedStatus: varchar('github_merged_status', { length: 32 }),
  issueCounter: integer('issue_counter').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('teams_estimate_scale_check', sql`${t.estimateScale} IN ('fibonacci', 'exponential', 'linear', 'free')`),
  check('teams_auto_archive_months_check', sql`${t.autoArchiveMonths} IS NULL OR ${t.autoArchiveMonths} BETWEEN 1 AND 60`),
  check('teams_auto_close_stale_months_check', sql`${t.autoCloseStaleMonths} IS NULL OR ${t.autoCloseStaleMonths} BETWEEN 1 AND 60`),
]);

export const teamMembers = pgTable(
  'team_members',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 32 }).notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })],
);
