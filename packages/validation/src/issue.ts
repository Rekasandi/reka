import { z } from 'zod';
import { issueStatusSchema, issuePrioritySchema, issueTypeSchema } from './common';

export const createIssueSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  status: issueStatusSchema.default('backlog'),
  priority: issuePrioritySchema.default('no_priority'),
  type: issueTypeSchema.default('task'),
  teamId: z.string().uuid(),
  projectId: z.string().uuid().optional().nullable(),
  cycleId: z.string().uuid().optional().nullable(),
  milestoneId: z.string().uuid().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  estimate: z.number().int().min(0).max(100).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
});

export const updateIssueSchema = createIssueSchema.partial().omit({ teamId: true });
