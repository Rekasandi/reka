import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';

export interface CommentItem {
  id: string;
  issueId: string;
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  body: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  issueId: string;
  actorId?: string;
  actorName?: string;
  type: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export function useIssueComments(issueId?: string) {
  return useQuery({
    queryKey: ['comments', issueId],
    queryFn: async () => {
      if (!issueId) return [];
      const res = await fetch(`/api/comments/by-issue/${issueId}`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      return (await res.json()) as CommentItem[];
    },
    enabled: !!issueId,
  });
}

export function useCreateComment(issueId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(`/api/comments/by-issue/${issueId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error('Failed to post comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', issueId] });
      queryClient.invalidateQueries({ queryKey: ['activities', issueId] });
      toast.success('Comment posted');
    },
    onError: (err) => {
      toast.error('Failed to post comment', {
        description: (err as Error).message,
      });
    },
  });
}

export function useIssueActivities(issueId?: string) {
  return useQuery({
    queryKey: ['activities', issueId],
    queryFn: async () => {
      if (!issueId) return [];
      const res = await fetch(`/api/activities/by-issue/${issueId}`);
      if (!res.ok) throw new Error('Failed to fetch activities');
      return (await res.json()) as ActivityItem[];
    },
    enabled: !!issueId,
  });
}
