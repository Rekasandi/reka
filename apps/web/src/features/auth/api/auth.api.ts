import type { UserRole } from '@reka/types';
import { authClient } from '../../../lib/auth-client';

export interface AuthWorkspace { id: string; name: string; slug: string; logoUrl?: string | null; role: UserRole }
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  githubUsername?: string | null;
  avatarUrl?: string | null;
  /** Role in the active workspace ("member" when there is none yet). */
  role: UserRole;
  /** The workspace this session works in; null until the user creates or joins one. */
  workspace: AuthWorkspace | null;
}

/** Returns the signed-in user with their active workspace, or `null` when there is no valid session. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch('/api/auth/me');
  if (!response.ok) return null;
  return (await response.json()) ?? null;
}

export async function logoutRequest(): Promise<void> {
  await authClient.signOut();
}
