import type { Issue } from '@reka/types';

export interface CreateIssueInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  type?: string;
  teamId: string;
  projectId?: string | null;
  assigneeId?: string | null;
  cycleId?: string | null;
  parentId?: string | null;
  estimate?: number | null;
  dueDate?: string | null;
  labelIds?: string[];
}

export type IssuePatch = Partial<Omit<Issue, 'dueDate'>> & { dueDate?: string | Date | null; labelIds?: string[] };
export interface BulkIssueUpdate { ids: string[]; status?: string; priority?: string; estimate?: number | null; dueDate?: string | null }
export interface IssueRelation { type: 'blocks' | 'blocked_by' | 'related_to' | 'duplicate'; relatedIssue: Issue; duplicateDirection?: 'source' | 'target' | 'unknown'; duplicateSourceIssueId?: string | null }

export async function getIssues(status?: string, archived = false): Promise<Issue[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (archived) params.set('archived', 'true');
  const query = params.toString();
  const url = query ? `/api/issues?${query}` : '/api/issues';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch issues');
  }
  return res.json();
}

export async function createIssue(input: CreateIssueInput): Promise<Issue> {
  const res = await fetch('/api/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error('Failed to create issue');
  }
  return res.json();
}

export async function updateIssue(id: string, input: IssuePatch): Promise<Issue> {
  const res = await fetch(`/api/issues/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error('Failed to update issue');
  }
  return res.json();
}

export async function deleteIssue(id: string): Promise<void> {
  const res = await fetch(`/api/issues/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Failed to delete issue');
  }
}

export async function getIssueById(id: string): Promise<Issue> {
  const res = await fetch(`/api/issues/${id}`);
  if (!res.ok) {
    throw new Error('Failed to fetch issue');
  }
  return res.json();
}

export async function getIssueByIdentifier(identifier: string): Promise<Issue> {
  const res = await fetch(`/api/issues/by-identifier/${identifier}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch issue ${identifier}`);
  }
  return res.json();
}

export async function updateIssues(input: BulkIssueUpdate): Promise<Issue[]> {
  const res = await fetch('/api/issues/bulk', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.message || 'Failed to update selected issues');
  }
  return res.json();
}

export async function archiveIssue(id: string, restore = false): Promise<Issue> {
  const res = await fetch(`/api/issues/${id}/${restore ? 'restore' : 'archive'}`, { method: 'POST' });
  if (!res.ok) throw new Error(restore ? 'Failed to restore issue' : 'Failed to archive issue');
  return res.json();
}

export async function moveIssueToTop(id: string): Promise<Issue> {
  const res = await fetch(`/api/issues/${id}/move-to-top`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to move issue');
  return res.json();
}

export async function getIssueRelations(issueId: string): Promise<IssueRelation[]> {
  const res = await fetch(`/api/issues/${issueId}/relations`);
  if (!res.ok) throw new Error('Failed to fetch issue relations');
  return res.json();
}

export async function addIssueRelation(issueId: string, relatedIssueId: string, type: IssueRelation['type']): Promise<IssueRelation> {
  const res = await fetch(`/api/issues/${issueId}/relations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relatedIssueId, type }) });
  if (!res.ok) throw new Error('Failed to add issue relation');
  return res.json();
}

export async function removeIssueRelation(issueId: string, relatedIssueId: string, type: IssueRelation['type']): Promise<void> {
  const res = await fetch(`/api/issues/${issueId}/relations/${relatedIssueId}?type=${encodeURIComponent(type)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to remove issue relation');
}

export async function getSubtasks(issueId: string): Promise<Issue[]> {
  const res = await fetch(`/api/issues/${issueId}/subtasks`);
  if (!res.ok) {
    throw new Error('Failed to fetch subtasks');
  }
  return res.json();
}
