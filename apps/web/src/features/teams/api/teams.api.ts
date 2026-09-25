import type { Issue } from '@reka/types';
import type { Cycle } from '../../cycles/api/cycles.api';

export interface TeamMember {
  teamId: string;
  userId: string;
  role: 'lead' | 'member' | 'viewer';
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  key: string;
  description?: string | null;
  memberCount?: number;
  issueCount?: number;
  members?: TeamMember[];
  issues?: Issue[];
  cycles?: Cycle[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamInput {
  name: string;
  key: string;
  description?: string;
}

export interface UpdateTeamInput {
  name?: string;
  key?: string;
  description?: string;
}

export interface AddTeamMemberInput {
  userId: string;
  role?: string;
}

export async function getTeams(): Promise<Team[]> {
  const res = await fetch('/api/teams');
  if (!res.ok) throw new Error('Failed to fetch teams');
  return res.json();
}

export async function getTeamById(id: string): Promise<Team> {
  const res = await fetch(`/api/teams/${id}`);
  if (!res.ok) throw new Error('Failed to fetch team');
  return res.json();
}

export async function createTeam(input: CreateTeamInput): Promise<Team> {
  const res = await fetch('/api/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.message || 'Failed to create team');
  }
  return res.json();
}

export async function addTeamMember(teamId: string, input: AddTeamMemberInput): Promise<TeamMember> {
  const res = await fetch(`/api/teams/${teamId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.message || 'Failed to add member');
  }
  return res.json();
}

export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  const res = await fetch(`/api/teams/${teamId}/members/${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to remove member');
}

export async function updateTeam(id: string, input: UpdateTeamInput): Promise<Team> {
  const res = await fetch(`/api/teams/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to update team');
  return res.json();
}

export async function deleteTeam(id: string): Promise<void> {
  const res = await fetch(`/api/teams/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete team');
}
