import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authClient, authErrorMessage } from '../../../lib/auth-client';

export const WORKSPACES_QUERY_KEY = ['auth', 'workspaces'] as const;
export const MY_INVITATIONS_QUERY_KEY = ['auth', 'my-invitations'] as const;

async function unwrap<T>(result: { data: T | null; error: { message?: string } | null }, fallback?: string): Promise<T> {
  if (result.error) throw new Error(authErrorMessage(result.error, fallback));
  return result.data as T;
}

/** Workspaces the signed-in user belongs to. */
export function useWorkspaces(enabled = true) {
  return useQuery({ queryKey: WORKSPACES_QUERY_KEY, queryFn: async () => unwrap(await authClient.organization.list(), 'Could not load your workspaces.'), enabled });
}

/** Invitations waiting for the signed-in user's email. */
export function useMyInvitations(enabled = true) {
  return useQuery({ queryKey: MY_INVITATIONS_QUERY_KEY, queryFn: async () => unwrap(await authClient.organization.listUserInvitations(), 'Could not load invitations.'), enabled });
}

/** Switch the session to another workspace, then reload every query: all data is scoped to the workspace. */
export function useSwitchWorkspace() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (organizationId: string) => unwrap(await authClient.organization.setActive({ organizationId }), 'Could not switch workspace.'),
    onSuccess: async () => { queryClient.clear(); navigate('/', { replace: true }); await queryClient.invalidateQueries(); },
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (input: { name: string; slug: string }) => unwrap(await authClient.organization.create(input), 'Could not create the workspace.'),
    onSuccess: async () => { queryClient.clear(); navigate('/', { replace: true }); await queryClient.invalidateQueries(); },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (invitationId: string) => unwrap(await authClient.organization.acceptInvitation({ invitationId }), 'Could not accept the invitation.'),
    onSuccess: async () => { queryClient.clear(); navigate('/', { replace: true }); await queryClient.invalidateQueries(); },
  });
}
