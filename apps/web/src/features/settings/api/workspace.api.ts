import type { UserRole } from '@reka/types';

export const WORKSPACE_QUERY_KEY = ['workspace'];
export const INVITATIONS_QUERY_KEY = ['workspace', 'invitations'];
export interface Workspace { id: string; name: string; slug: string; role: UserRole }
export interface WorkspaceInvitation {
  id: string; email: string; role: 'admin' | 'member'; expiresAt: string;
  acceptedAt: string | null; revokedAt: string | null; createdAt: string;
}
export interface CreatedInvitation { id: string; email: string; role: 'admin' | 'member'; expiresAt: string; url: string }

async function request<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch(`/api/workspace${path}`, { method, headers: { 'Content-Type': 'application/json' },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join('; ') : body.message || 'Workspace request failed. Try again.');
  return body;
}
export const getWorkspace = () => request<Workspace>('');
export const updateWorkspace = (name: string) => request<Workspace>('', 'PATCH', { name });
export const getWorkspaceInvitations = () => request<WorkspaceInvitation[]>('/invitations');
export const createWorkspaceInvitation = (data: { email: string; role: 'admin' | 'member'; expiresInDays: number }) => request<CreatedInvitation>('/invitations', 'POST', data);
export const revokeWorkspaceInvitation = (id: string) => request<{ success: boolean }>(`/invitations/${id}/revoke`, 'POST');
export const updateWorkspaceMember = (id: string, data: { role?: UserRole; isActive?: boolean }) => request<{ id: string; role: UserRole; isActive: boolean }>(`/members/${id}`, 'PATCH', data);
