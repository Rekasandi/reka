import type { UserRole } from '@reka/types';
import { authClient, authErrorMessage } from '../../../lib/auth-client';

export const WORKSPACE_QUERY_KEY = ['workspace'];
export const INVITATIONS_QUERY_KEY = ['workspace', 'invitations'];
export interface Workspace { id: string; name: string; slug: string; role: UserRole }
export interface WorkspaceInvitation { id: string; email: string; role: string; status: 'pending' | 'accepted' | 'rejected' | 'canceled'; expiresAt: string | Date }

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
export const updateWorkspaceMember = (id: string, data: { role?: UserRole; isActive?: boolean }) => request<{ id: string; role: UserRole; isActive: boolean }>(`/members/${id}`, 'PATCH', data);

// Invitations live in Better Auth (organization plugin), scoped to the active workspace.
export async function getWorkspaceInvitations(): Promise<WorkspaceInvitation[]> {
  const result = await authClient.organization.listInvitations();
  if (result.error) throw new Error(authErrorMessage(result.error, 'Could not load invitations.'));
  return result.data as WorkspaceInvitation[];
}
export async function revokeWorkspaceInvitation(invitationId: string): Promise<void> {
  const result = await authClient.organization.cancelInvitation({ invitationId });
  if (result.error) throw new Error(authErrorMessage(result.error, 'Could not revoke the invitation.'));
}
