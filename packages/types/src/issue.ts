import type { IssueStatus, IssuePriority, IssueType } from './common';

export type IssueStatusCategory = 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';

export interface Issue {
  id: string;
  identifier: string; // e.g. "RS-123"
  number: number;
  title: string;
  description?: string | null;
  status: IssueStatus | string;
  statusLabel?: string;
  statusCategory?: IssueStatusCategory;
  statusPosition?: number;
  priority: IssuePriority;
  type: IssueType;
  teamId: string;
  projectId?: string | null;
  milestoneId?: string | null;
  cycleId?: string | null;
  assigneeId?: string | null;
  labels?: Label[];
  reporterId: string;
  parentId?: string | null;
  estimate?: number | null;
  dueDate?: Date | string | null;
  archivedAt?: Date | string | null;
  labelIds?: string[];
  githubIssueNumber?: number | null;
  githubIssueUrl?: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export function getIssueStatusCategory(issue: Pick<Issue, 'status' | 'statusCategory'>): IssueStatusCategory {
  if (issue.statusCategory) return issue.statusCategory;
  if (issue.status === 'triage') return 'triage';
  if (issue.status === 'backlog') return 'backlog';
  if (issue.status === 'todo') return 'unstarted';
  if (issue.status === 'done') return 'completed';
  if (issue.status === 'canceled') return 'canceled';
  return 'started';
}

export function isIssueClosed(issue: Pick<Issue, 'status' | 'statusCategory'>) {
  return ['completed', 'canceled'].includes(getIssueStatusCategory(issue));
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
