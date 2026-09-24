import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getIssues, createIssue, updateIssue, deleteIssue, type CreateIssueInput } from '../api/issues.api';
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
