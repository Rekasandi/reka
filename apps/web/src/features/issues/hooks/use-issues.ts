import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getIssueById, getIssues, createIssue, updateIssue, updateIssues, deleteIssue, archiveIssue, moveIssueToTop, getSubtasks, type CreateIssueInput, type IssuePatch, type BulkIssueUpdate } from '../api/issues.api';
import type { Issue, Label } from '@reka/types';
import { toast } from '@reka/ui';

export const ISSUES_QUERY_KEY = ['issues'];

export function useIssue(id?: string) {
  return useQuery({ queryKey: [...ISSUES_QUERY_KEY, 'detail', id], queryFn: () => getIssueById(id!), enabled: !!id });
}

export function useIssues(status?: string, archived = false) {
  return useQuery({
    queryKey: [...ISSUES_QUERY_KEY, status ?? 'all', archived ? 'archived' : 'active'],
    queryFn: () => getIssues(status, archived),
  });
}

export function useCreateLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { teamId: string; projectId?: string | null; name: string; color?: string }) => {
      const response = await fetch('/api/labels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Could not create label');
      return response.json() as Promise<Label>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
      toast.success('Label created');
    },
    onError: (error) => toast.error('Could not create label', { description: (error as Error).message }),
  });
}

export function useUpdateLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const response = await fetch(`/api/labels/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Could not update label');
      return response.json() as Promise<Label>;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['labels'] }); queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY }); toast.success('Label updated'); },
    onError: error => toast.error('Could not update label', { description: (error as Error).message }),
  });
}

export function useDeleteLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/labels/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Could not delete label');
      return response.json() as Promise<{ id: string; success: boolean }>;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['labels'] }); queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY }); toast.success('Label deleted'); },
    onError: error => toast.error('Could not delete label', { description: (error as Error).message }),
  });
}

export function useIssueLabels() {
  return useQuery({
    queryKey: ['labels'],
    queryFn: async (): Promise<Label[]> => {
      const response = await fetch('/api/labels');
      if (!response.ok) throw new Error('Failed to fetch labels');
      return response.json();
    },
  });
}

export function useCreateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateIssueInput) => createIssue(input),
    onSuccess: (newIssue) => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['triage'] });
      toast.success(`Issue ${newIssue.identifier} created`, {
        description: newIssue.title,
      });
    },
    onError: (err) => {
      toast.error('Failed to create issue', {
        description: (err as Error).message,
      });
    },
  });
}

export function useUpdateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: IssuePatch }) => updateIssue(id, data),
    onSuccess: (updated, { data }) => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['triage'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      if (data.cycleId !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['cycles'] });
        queryClient.invalidateQueries({ queryKey: ['cycle'] });
      }
      toast.info(`Updated ${updated.identifier}`, {
        description: `Status: ${updated.status}`,
      });
    },
    onError: (err) => {
      toast.error('Failed to update issue', {
        description: (err as Error).message,
      });
    },
  });
}

export function useBulkUpdateIssues() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkIssueUpdate) => updateIssues(input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['triage'] });
      toast.success(`Updated ${updated.length} issues`);
    },
    onError: (error) => toast.error('Bulk update failed', { description: (error as Error).message }),
  });
}

export function useArchiveIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, restore = false }: { id: string; restore?: boolean }) => archiveIssue(id, restore),
    onSuccess: (issue, { restore }) => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['triage'] });
      toast.success(restore ? `Restored ${issue.identifier}` : `Archived ${issue.identifier}`);
    },
    onError: (error) => toast.error('Issue action failed', { description: (error as Error).message }),
  });
}

export function useMoveIssueToTop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => moveIssueToTop(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY }),
    onError: (error) => toast.error('Could not reorder issue', { description: (error as Error).message }),
  });
}

export function useDeleteIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteIssue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['triage'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      toast.success('Issue deleted');
    },
    onError: (err) => {
      toast.error('Failed to delete issue', {
        description: (err as Error).message,
      });
    },
  });
}

export function useSubtasks(issueId?: string) {
  return useQuery({
    queryKey: ['subtasks', issueId],
    queryFn: () => (issueId ? getSubtasks(issueId) : Promise.resolve([])),
    enabled: !!issueId,
  });
}

export function useCreateSubtask(parentId?: string, teamId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) =>
      createIssue({
        title,
        parentId,
        teamId: teamId!,
        type: 'task',
        status: 'todo',
        priority: 'no_priority',
      }),
    onSuccess: (newSubtask) => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', parentId] });
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
      toast.success(`Sub-task ${newSubtask.identifier} added`);
    },
    onError: (err) => {
      toast.error('Failed to add sub-task', {
        description: (err as Error).message,
      });
    },
  });
}
