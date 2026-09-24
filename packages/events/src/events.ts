import type { Issue, IssueStatus, IssuePriority } from '@reka/types';

export const DOMAIN_EVENTS = {
  ISSUE_CREATED: 'issue.created',
  ISSUE_UPDATED: 'issue.updated',
  ISSUE_STATUS_CHANGED: 'issue.status_changed',
  ISSUE_ASSIGNED: 'issue.assigned',
  ISSUE_COMMENT_CREATED: 'issue.comment_created',
  PROJECT_CREATED: 'project.created',
  CYCLE_STARTED: 'cycle.started',
  CYCLE_COMPLETED: 'cycle.completed',
  GITHUB_PR_OPENED: 'github.pr_opened',
  GITHUB_PR_MERGED: 'github.pr_merged',
  GITHUB_PR_REVIEW_SUBMITTED: 'github.pr_review_submitted',
} as const;

export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export interface BaseDomainEvent<T = unknown> {
  id: string;
  name: DomainEventName;
  timestamp: Date;
  actorId?: string;
  payload: T;
}

export interface IssueCreatedEvent extends BaseDomainEvent<{ issue: Issue }> {
  name: typeof DOMAIN_EVENTS.ISSUE_CREATED;
}

export interface IssueStatusChangedEvent
  extends BaseDomainEvent<{
    issueId: string;
    fromStatus: IssueStatus;
    toStatus: IssueStatus;
  }> {
  name: typeof DOMAIN_EVENTS.ISSUE_STATUS_CHANGED;
}

export interface GithubPrMergedEvent
  extends BaseDomainEvent<{
    repository: string;
    prNumber: number;
    branchName: string;
    mergedBy: string;
    issueIdentifiers: string[]; // e.g. ["RS-123"]
  }> {
  name: typeof DOMAIN_EVENTS.GITHUB_PR_MERGED;
}
