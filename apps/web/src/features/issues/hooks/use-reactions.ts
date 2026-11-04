import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';
import { getIssueReactions, toggleReaction } from '../api/reactions.api';

export function useIssueReactions(issueId?: string) {
  return useQuery({ queryKey: ['reactions', issueId], queryFn: () => getIssueReactions(issueId!), enabled: !!issueId });
}

export function useToggleReaction(issueId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ target, emoji }: { target: { issueId?: string; commentId?: string }; emoji: string }) => toggleReaction(target, emoji),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reactions', issueId] }),
    onError: error => toast.error('Could not update reaction', { description: (error as Error).message }),
  });
}
