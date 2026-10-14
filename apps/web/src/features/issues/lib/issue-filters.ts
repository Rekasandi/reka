import type { Issue } from '@reka/types';

export interface IssueFilters {
  assigneeIds: string[];
  labelIds: string[];
  priorities: string[];
  projectIds: string[];
}

export const EMPTY_ISSUE_FILTERS: IssueFilters = {
  assigneeIds: [],
  labelIds: [],
  priorities: [],
  projectIds: [],
};

export function filterIssues(issues: Issue[], filters: IssueFilters): Issue[] {
  return issues.filter((issue) => {
    if (filters.assigneeIds.length && !filters.assigneeIds.includes(issue.assigneeId || 'unassigned')) return false;
    if (filters.priorities.length && !filters.priorities.includes(issue.priority)) return false;
    if (filters.projectIds.length && !filters.projectIds.includes(issue.projectId || 'unassigned')) return false;
    if (filters.labelIds.length && !issue.labels?.some((label) => filters.labelIds.includes(label.id))) return false;
    return true;
  });
}
