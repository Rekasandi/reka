import type { ProjectStatus, ProjectHealth, IssuePriority } from './common';

export interface Project {
  id: string;
  organizationId: string;
  teamId?: string | null;
  clientId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  priority: IssuePriority;
  ownerId: string;
  startDate?: Date | null;
  targetDate?: Date | null;
  budget?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  organizationId: string;
  name: string;
  industry?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
