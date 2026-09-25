import { pgTable, text, timestamp, uuid, varchar, integer, primaryKey } from 'drizzle-orm/pg-core';
import { teams } from './teams';
import { projects } from './projects';
import { cycles } from './cycles';
import { milestones } from './milestones';
import { users } from './users';
import { labels } from './labels';

export const issues = pgTable('issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: varchar('identifier', { length: 32 }).notNull().unique(), // e.g. "RS-123"
  number: integer('number').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 32 }).notNull().default('backlog'),
  priority: varchar('priority', { length: 32 }).notNull().default('no_priority'),
  type: varchar('type', { length: 32 }).notNull().default('task'),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  cycleId: uuid('cycle_id').references(() => cycles.id, { onDelete: 'set null' }),
  milestoneId: uuid('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  reporterId: uuid('reporter_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  parentId: uuid('parent_id'),
  estimate: integer('estimate'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  githubIssueNumber: integer('github_issue_number'),
  githubIssueUrl: text('github_issue_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const issueLabels = pgTable(
  'issue_labels',
  {
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.labelId] })],
);

export const issueRelations = pgTable(
  'issue_relations',
  {
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    relatedIssueId: uuid('related_issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 32 }).notNull(), // 'blocks' | 'blocked_by' | 'related_to' | 'duplicate'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.relatedIssueId, t.type] })],
);
