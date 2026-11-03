export interface AuthUser {
  id: string;
  name: string;
  email: string;
  githubUsername?: string | null;
  avatarUrl?: string | null;
  role: 'owner' | 'admin' | 'member' | 'guest' | 'client';
}

/** Returns the signed-in user, or `null` when there is no valid session. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch('/api/auth/me');
  if (!response.ok) return null;
  return (await response.json()) ?? null;
}

export async function logoutRequest(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}
