import { z } from 'zod';
import { userRoleSchema } from './common';

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  avatarUrl: z.string().url().optional().nullable(),
  role: userRoleSchema.default('member'),
});

export const updateUserSchema = createUserSchema.partial();
