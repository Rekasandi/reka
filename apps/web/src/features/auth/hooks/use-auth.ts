import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, logoutRequest, type AuthUser } from '../api/auth.api';

export type { AuthUser };
export const AUTH_QUERY_KEY = ['auth', 'me'] as const;

/** The current session, owned by TanStack Query (replaces the former zustand auth store). */
export function useAuth() {
  const query = useQuery({ queryKey: AUTH_QUERY_KEY, queryFn: getCurrentUser, staleTime: Infinity, retry: false });
  const user = query.data ?? null;
  return { user, isAuthenticated: !!user, isLoading: query.isLoading };
}

/** Patch the cached session user (e.g. after the signed-in user edits their own profile). */
export function useUpdateAuthUser() {
  const client = useQueryClient();
  return (patch: Partial<AuthUser>) => client.setQueryData<AuthUser | null>(AUTH_QUERY_KEY, current => (current ? { ...current, ...patch } : current));
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => { try { await logoutRequest(); } catch { /* the session is cleared client-side regardless */ } },
    onSettled: () => {
      client.setQueryData(AUTH_QUERY_KEY, null);
      window.location.assign('/login');
    },
  });
}
