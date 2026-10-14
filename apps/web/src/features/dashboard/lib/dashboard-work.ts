import { addDays, isValid, parseISO, startOfDay } from 'date-fns';
import { isIssueClosed, type Issue } from '@reka/types';
import type { Project } from '../../projects/api/projects.api';

export function workDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : parseISO(value);
  return isValid(date) ? date : null;
}

export function attentionReasons(issue: Issue, now = new Date()): string[] {
  if (isIssueClosed(issue)) return [];
  const due = workDate(issue.dueDate);
  return [
    issue.status === 'blocked' && 'Blocked',
    due && due < startOfDay(now) && 'Overdue',
    !issue.assigneeId && 'Unassigned',
    issue.priority === 'urgent' && 'Urgent',
  ].filter((reason): reason is string => typeof reason === 'string');
}

export type UpcomingTarget =
  | { kind: 'issue'; issue: Issue; date: Date }
  | { kind: 'project'; project: Project; date: Date };

export function upcomingTargets(issues: Issue[], projects: Project[], now = new Date()): UpcomingTarget[] {
  const start = startOfDay(now);
  const end = addDays(start, 8); // Today plus the next seven calendar days, inclusive.
  const targets: UpcomingTarget[] = [];
  for (const issue of issues) {
    const date = workDate(issue.dueDate);
    if (date && date >= start && date < end && !isIssueClosed(issue)) {
      targets.push({ kind: 'issue', issue, date });
    }
  }
  for (const project of projects) {
    const date = workDate(project.targetDate);
    if (date && date >= start && date < end && project.status !== 'completed' && project.status !== 'canceled') {
      targets.push({ kind: 'project', project, date });
    }
  }
  return targets.sort((a, b) => a.date.getTime() - b.date.getTime());
}
