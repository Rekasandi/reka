export type IssueStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'done'
  | 'canceled'
  | 'blocked';

export type IssuePriority = 'no_priority' | 'low' | 'medium' | 'high' | 'urgent';

export type IssueType = 'task' | 'bug' | 'feature' | 'improvement' | 'chore';

export type IssueRelationType = 'blocks' | 'blocked_by' | 'related_to' | 'duplicate';

export type ProjectStatus =
  | 'planned'
  | 'backlog'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'canceled';

export type ProjectHealth = 'on_track' | 'at_risk' | 'off_track';

export type UserRole = 'owner' | 'admin' | 'member' | 'guest' | 'client';

export type NotificationType =
  | 'mention'
  | 'assignment'
  | 'status_change'
  | 'comment'
  | 'pr_review_requested'
  | 'pr_approved'
  | 'pr_merged'
  | 'deadline_approaching'
  | 'issue_blocked';
