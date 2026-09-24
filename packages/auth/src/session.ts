import type { UserRole } from '@reka/types';

export interface AuthSession {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  createdAt: number;
  expiresAt: number;
}

export function isSessionExpired(session: AuthSession): boolean {
  return Date.now() > session.expiresAt;
}
