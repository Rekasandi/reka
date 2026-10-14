export interface IssueSubscriptionState { subscribed: boolean; createdAt: string | null }
export interface IssueAttachment { id: string; issueId: string; uploaderId: string; fileName: string; fileSize: number; mimeType: string; url: string; createdAt: string; canDelete: boolean }

async function errorMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  return Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message || fallback;
}

export async function getIssueSubscription(issueId: string): Promise<IssueSubscriptionState> {
  const response = await fetch(`/api/issues/${issueId}/subscription`);
  if (!response.ok) throw new Error(await errorMessage(response, 'Failed to load subscription'));
  return response.json();
}
export async function setIssueSubscription(issueId: string, subscribed: boolean): Promise<IssueSubscriptionState> {
  const response = await fetch(`/api/issues/${issueId}/subscription`, { method: subscribed ? 'POST' : 'DELETE' });
  if (!response.ok) throw new Error(await errorMessage(response, 'Failed to update subscription'));
  return response.json();
}
export async function getIssueAttachments(issueId: string): Promise<IssueAttachment[]> {
  const response = await fetch(`/api/attachments/by-issue/${issueId}`);
  if (!response.ok) throw new Error(await errorMessage(response, 'Failed to load attachments'));
  return response.json();
}
export async function uploadIssueAttachment(issueId: string, file: File): Promise<IssueAttachment> {
  const body = new FormData(); body.append('file', file);
  const response = await fetch(`/api/attachments/by-issue/${issueId}`, { method: 'POST', body });
  if (!response.ok) throw new Error(await errorMessage(response, 'Failed to upload attachment'));
  return response.json();
}
export async function deleteIssueAttachment(id: string): Promise<void> {
  const response = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await errorMessage(response, 'Failed to delete attachment'));
}
