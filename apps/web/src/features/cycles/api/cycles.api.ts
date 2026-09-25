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
  createdAt: string;
  updatedAt: string;
}

export interface CreateCycleInput {
  name?: string;
  description?: string;
  startDate: string;
  endDate: string;
}

export interface UpdateCycleInput {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isCompleted?: boolean;
}

export interface CompleteCycleInput {
  incompleteIssuesAction: 'backlog' | 'next_cycle';
  nextCycleId?: string;
}

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

export async function completeCycle(id: string, input: CompleteCycleInput): Promise<{ success: boolean; rolledOverCount: number }> {
  const res = await fetch(`/api/cycles/${id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to complete cycle');
  return res.json();
}

export async function deleteCycle(id: string): Promise<void> {
  const res = await fetch(`/api/cycles/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete cycle');
}
