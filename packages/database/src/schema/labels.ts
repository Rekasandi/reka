import { type AnyPgColumn, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { teams } from './teams';
import { projects } from './projects';

export const labels = pgTable('labels', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  color: varchar('color', { length: 32 }).notNull().default('#6b7280'),
  description: text('description'),
  /** Label group: a top-level label that this label belongs to (one level only; an issue holds at most one label per group). */
  parentId: uuid('parent_id').references((): AnyPgColumn => labels.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
