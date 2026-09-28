import type { ProjectStatus, ProjectHealth, IssuePriority } from './common';
import type { GithubRepository } from './github';

export interface Project {
  id: string;
  organizationId: string;
  teamId: string;
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
  repositories?: GithubRepository[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  organizationId: string;
  name: string;
  industry?: string | null;
  notes?: string | null;
  projectCount?: number;
  contactCount?: number;
  contacts?: ClientContact[];
  projects?: Project[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  email: string;
  role?: string | null;
  phone?: string | null;
  createdAt: Date | string;
}

