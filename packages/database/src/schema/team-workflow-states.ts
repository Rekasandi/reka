import { pgTable, uuid, varchar, integer, boolean, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { teams } from './teams';

export const teamWorkflowStates = pgTable('team_workflow_states', {
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 32 }).notNull(),
  name: varchar('name', { length: 64 }).notNull(),
  category: varchar('category', { length: 16 }).notNull(),
  color: varchar('color', { length: 7 }).notNull().default('#8f8f8f'),
  position: integer('position').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.teamId, t.key] })]);
