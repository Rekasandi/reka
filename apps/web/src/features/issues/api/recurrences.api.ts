export interface IssueRecurrence {
  id: string;
  sourceIssueId: string;
  intervalCount: number;
  unit: 'day' | 'week' | 'month';
  timezone: string;
  nextRunAt: string;
  enabled: boolean;
  template: { dueDateOffsetDays: number | null };
  recentRuns: { id: string; scheduledFor: string; issueId: string | null }[];
}

export interface ConfigureIssueRecurrenceInput {
  intervalCount: number;
  unit: IssueRecurrence['unit'];
  timezone: string;
  nextRunAt: string;
  dueDateOffsetDays: number | null;
}

export async function getIssueRecurrence(issueId: string): Promise<IssueRecurrence | null> {
  const response = await fetch(`/api/issues/${issueId}/recurrence`);
  if (!response.ok) throw new Error('Failed to fetch issue recurrence');
  const body = await response.text();
  return body ? JSON.parse(body) as IssueRecurrence : null;
}

export async function configureIssueRecurrence(issueId: string, input: ConfigureIssueRecurrenceInput): Promise<IssueRecurrence> {
  const response = await fetch(`/api/issues/${issueId}/recurrence`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || 'Failed to configure recurrence');
  return body;
}

export async function stopIssueRecurrence(issueId: string): Promise<void> {
  const response = await fetch(`/api/issues/${issueId}/recurrence`, { method: 'DELETE' });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || 'Failed to stop recurrence');
}
