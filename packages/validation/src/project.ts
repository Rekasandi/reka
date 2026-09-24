import { z } from 'zod';
import { projectStatusSchema, projectHealthSchema, issuePrioritySchema } from './common';

export const createProjectSchema = z.object({
  organizationId: z.string().uuid(),
  teamId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  status: projectStatusSchema.default('planned'),
  health: projectHealthSchema.default('on_track'),
  priority: issuePrioritySchema.default('medium'),
  ownerId: z.string().uuid(),
  startDate: z.coerce.date().optional().nullable(),
  targetDate: z.coerce.date().optional().nullable(),
  budget: z.number().nonnegative().optional().nullable(),
});

export const updateProjectSchema = createProjectSchema.partial().omit({ organizationId: true });
