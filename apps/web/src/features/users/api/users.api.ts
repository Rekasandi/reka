import type { Issue } from '@reka/types';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  githubUsername?: string | null;
  role: 'owner' | 'admin' | 'member' | 'guest' | 'client';
  isActive?: boolean;
  admission?: 'legacy' | 'pending' | 'invited';
  assignedIssuesCount?: number;
  teamsCount?: number;
  assignedIssues?: Issue[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role?: string;
  avatarUrl?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

export async function getUsers(includeInactive = false): Promise<User[]> {
  const res = await fetch(includeInactive ? '/api/users?includeInactive=true' : '/api/users');
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function getUserById(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.message || 'Failed to create user');
  }
  return res.json();
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const res = await fetch(`/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.message || 'Failed to update user');
  }
  return res.json();
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`/api/users/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || 'Failed to deactivate user');
  }
}
