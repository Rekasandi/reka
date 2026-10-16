import type { Issue } from '@reka/types';

export type IntakeField = { key: string; label: string; type: 'text' | 'textarea' | 'select'; required: boolean; options?: string[] };
export interface IssueTemplate {
  id: string; organizationId: string; teamId: string | null; name: string; titlePrefix: string; description: string | null;
  defaultStatus: string; defaultType: string; defaultPriority: string; defaultEstimate: number | null; fields: IntakeField[];
}
export interface IntakeSubmission { title: string; teamId?: string; answers: Record<string, string> }

async function requestJson<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export const getTriage = (teamId?: string) => requestJson<Issue[]>(`/api/triage${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''}`);
export const getIssueTemplates = (teamId?: string) => requestJson<IssueTemplate[]>(`/api/issue-templates${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''}`);
export const createIssueTemplate = (input: Omit<IssueTemplate, 'id' | 'organizationId'>) => requestJson<IssueTemplate>('/api/issue-templates', 'POST', input);
export const deleteIssueTemplate = (id: string) => requestJson<{ success: boolean }>(`/api/issue-templates/${id}`, 'DELETE');
export const submitIssueTemplate = (id: string, input: IntakeSubmission) => requestJson<any>(`/api/issue-templates/${id}/submit`, 'POST', input);
export const acceptTriageIssue = (id: string, input: { teamId: string; status: string; assigneeId?: string | null }) => requestJson<any>(`/api/triage/${id}/accept`, 'POST', input);
export const declineTriageIssue = (id: string, reason: string) => requestJson<any>(`/api/triage/${id}/decline`, 'POST', { reason });
export const duplicateTriageIssue = (id: string, relatedIssueId: string, reason = '') => requestJson<any>(`/api/triage/${id}/duplicate`, 'POST', { relatedIssueId, reason });
