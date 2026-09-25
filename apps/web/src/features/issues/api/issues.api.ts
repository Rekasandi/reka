import type { Issue } from '@reka/types';

export interface CreateIssueInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  type?: string;
  parentId?: string | null;
}

export async function getIssues(status?: string): Promise<Issue[]> {
  const url = status ? `/api/issues?status=${status}` : '/api/issues';
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

export async function updateIssue(id: string, input: Partial<Issue>): Promise<Issue> {
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

export async function getSubtasks(issueId: string): Promise<Issue[]> {
  const res = await fetch(`/api/issues/${issueId}/subtasks`);
  if (!res.ok) {
    throw new Error('Failed to fetch subtasks');
  }
  return res.json();
}
