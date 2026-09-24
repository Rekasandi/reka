import { z } from 'zod';

export const issueStatusSchema = z.enum([
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'canceled',
  'blocked',
]);

export const issuePrioritySchema = z.enum(['no_priority', 'low', 'medium', 'high', 'urgent']);

export const issueTypeSchema = z.enum(['task', 'bug', 'feature', 'improvement', 'chore']);

export const projectStatusSchema = z.enum([
  'planned',
  'backlog',
  'in_progress',
  'paused',
  'completed',
  'canceled',
]);

export const projectHealthSchema = z.enum(['on_track', 'at_risk', 'off_track']);

export const userRoleSchema = z.enum(['owner', 'admin', 'member', 'guest', 'client']);
