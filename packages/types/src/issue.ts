import type { IssueStatus, IssuePriority, IssueType } from './common';

export interface Issue {
  id: string;
  identifier: string; // e.g. "RS-123"
  number: number;
  title: string;
  description?: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  type: IssueType;
  teamId: string;
  projectId?: string | null;
  cycleId?: string | null;
  milestoneId?: string | null;
  assigneeId?: string | null;
  reporterId: string;
  parentId?: string | null;
  estimate?: number | null;
  dueDate?: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Label {
  id: string;
  organizationId: string;
  teamId?: string | null;
  projectId?: string | null;
  name: string;
  color: string;
  description?: string | null;
  createdAt: Date;
}

export interface Comment {
  id: string;
  issueId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}
