import type { Issue } from '@reka/types';

export interface Cycle {
  id: string;
  teamId: string;
  number: number;
  name?: string | null;
  description?: string | null;
  startDate: string;
  endDate: string;
  isCompleted: boolean;
  status: 'active' | 'upcoming' | 'completed';
  totalIssues?: number;
  completedIssues?: number;
  progress?: number;
  issues?: Issue[];
  remainingIssues?: number;
  capacity?: number | null;
  plannedEstimate?: number;
  completedEstimate?: number;
  remainingEstimate?: number;
  missingEstimateCount?: number;
  remainingCapacity?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCycleInput {
  teamId: string;
  name?: string;
  description?: string;
  startDate: string;
  endDate: string;
  capacity?: number | null;
}

export interface UpdateCycleInput {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  capacity?: number | null;
}

export interface CompleteCycleInput {
  incompleteIssuesAction: 'backlog' | 'next_cycle';
  nextCycleId?: string;
}

export interface TeamCycleSettings {
  teamId: string; timezone: string; durationDays: number; cooldownDays: number; nextStartDate: string; autoCreate: boolean;
  updatedBy: string; createdAt: string; updatedAt: string;
}
export interface CycleSnapshot {
  id: string; cycleId: string; snapshotAt: string; totalIssueCount: number; completedIssueCount: number; remainingIssueCount: number;
  plannedEstimate: number; completedEstimate: number; remainingEstimate: number; missingEstimateCount: number; createdAt: string;
}
export interface CycleHistory { snapshots: CycleSnapshot[]; hasHistory: boolean; historyStartsAt: string | null }

export async function getCycles(): Promise<Cycle[]> {
  const res = await fetch('/api/cycles');
  if (!res.ok) throw new Error('Failed to fetch cycles');
  return res.json();
}

export async function getCycleById(id: string): Promise<Cycle> {
  const res = await fetch(`/api/cycles/${id}`);
  if (!res.ok) throw new Error('Failed to fetch cycle');
  return res.json();
}

export async function createCycle(input: CreateCycleInput): Promise<Cycle> {
  const res = await fetch('/api/cycles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to create cycle');
  return res.json();
}

export async function updateCycle(id: string, input: UpdateCycleInput): Promise<Cycle> {
  const res = await fetch(`/api/cycles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to update cycle');
  return res.json();
}

export async function completeCycle(id: string, input: CompleteCycleInput): Promise<{ success: boolean; rolledOverCount: number; targetCycleId: string | null; alreadyCompleted: boolean }> {
  const res = await fetch(`/api/cycles/${id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to complete cycle');
  return res.json();
}

export async function reopenCycle(id: string): Promise<{ success: boolean; alreadyOpen: boolean }> {
  const res = await fetch(`/api/cycles/${id}/reopen`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reopen cycle');
  return res.json();
}

export async function getCycleHistory(id: string): Promise<CycleHistory> {
  const res = await fetch(`/api/cycles/${id}/history`);
  if (!res.ok) throw new Error('Failed to fetch cycle history');
  return res.json();
}

export async function getTeamCycleSettings(teamId: string): Promise<TeamCycleSettings | null> {
  const res = await fetch(`/api/cycles/settings/${encodeURIComponent(teamId)}`);
  if (!res.ok) throw new Error('Failed to fetch team cycle settings');
  const body = await res.text();
  return body ? JSON.parse(body) as TeamCycleSettings : null;
}

export async function saveTeamCycleSettings(teamId: string, input: Omit<TeamCycleSettings, 'teamId' | 'updatedBy' | 'createdAt' | 'updatedAt'>): Promise<TeamCycleSettings> {
  const res = await fetch(`/api/cycles/settings/${encodeURIComponent(teamId)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message || 'Failed to save schedule');
  }
  return res.json();
}

export async function deleteCycle(id: string): Promise<void> {
  const res = await fetch(`/api/cycles/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete cycle');
}
