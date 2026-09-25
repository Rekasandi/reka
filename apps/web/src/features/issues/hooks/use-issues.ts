import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getIssues, createIssue, updateIssue, deleteIssue, getSubtasks, type CreateIssueInput } from '../api/issues.api';
import type { Issue } from '@reka/types';
import { toast } from '@reka/ui';

export const ISSUES_QUERY_KEY = ['issues'];

export function useIssues(status?: string) {
  return useQuery({
    queryKey: status ? [...ISSUES_QUERY_KEY, status] : ISSUES_QUERY_KEY,
    queryFn: () => getIssues(status),
  });
}

export function useCreateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateIssueInput) => createIssue(input),
    onSuccess: (newIssue) => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
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
    mutationFn: ({ id, data }: { id: string; data: Partial<Issue> }) => updateIssue(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
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

export function useDeleteIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteIssue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
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

export function useCreateSubtask(parentId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) =>
      createIssue({
        title,
        parentId,
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
