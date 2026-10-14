import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, boolean, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { teams } from './teams';
import { users } from './users';

export type IssueTemplateField = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
};

export const issueTemplates = pgTable('issue_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  titlePrefix: varchar('title_prefix', { length: 80 }).notNull().default(''),
  description: text('description'),
  defaultStatus: varchar('default_status', { length: 32 }).notNull().default('triage'),
  defaultType: varchar('default_type', { length: 32 }).notNull().default('task'),
  defaultPriority: varchar('default_priority', { length: 32 }).notNull().default('no_priority'),
  defaultEstimate: integer('default_estimate'),
  fields: jsonb('fields').$type<IssueTemplateField[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('issue_templates_team_name_unique_idx').on(t.organizationId, t.teamId, t.name),
  check('issue_templates_estimate_check', sql`${t.defaultEstimate} IS NULL OR (${t.defaultEstimate} BETWEEN 0 AND 100)`),
]);
