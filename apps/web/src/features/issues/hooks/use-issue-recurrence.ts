import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';
import { configureIssueRecurrence, getIssueRecurrence, stopIssueRecurrence, type ConfigureIssueRecurrenceInput } from '../api/recurrences.api';

export const issueRecurrenceKey = (issueId: string) => ['issue-recurrence', issueId] as const;

export function useIssueRecurrence(issueId: string) {
  return useQuery({ queryKey: issueRecurrenceKey(issueId), queryFn: () => getIssueRecurrence(issueId), enabled: !!issueId });
}

export function useConfigureIssueRecurrence(issueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfigureIssueRecurrenceInput) => configureIssueRecurrence(issueId, input),
    onSuccess: (recurrence) => { queryClient.setQueryData(issueRecurrenceKey(issueId), recurrence); toast.success('Recurrence saved'); },
    onError: (error) => toast.error('Could not save recurrence', { description: (error as Error).message }),
  });
}

export function useStopIssueRecurrence(issueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => stopIssueRecurrence(issueId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: issueRecurrenceKey(issueId) }); toast.success('Future occurrences stopped'); },
    onError: (error) => toast.error('Could not stop recurrence', { description: (error as Error).message }),
  });
}
