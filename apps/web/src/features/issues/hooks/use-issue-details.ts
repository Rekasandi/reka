import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';
import { addIssueRelation, getIssueRelations, removeIssueRelation, type IssueRelation } from '../api/issues.api';
import { deleteIssueAttachment, getIssueAttachments, getIssueSubscription, setIssueSubscription, uploadIssueAttachment } from '../api/collaboration.api';

export interface CommentItem {
  id: string; issueId: string; authorId: string; authorName?: string; authorAvatar?: string;
  body: string; createdAt: string; updatedAt?: string; canEdit?: boolean;
}
export interface ActivityItem {
  id: string; issueId: string; actorId?: string; actorName?: string; type: string;
  metadata?: Record<string, any>; createdAt: string;
}

export function useIssueComments(issueId?: string) {
  return useQuery({
    queryKey: ['comments', issueId],
    queryFn: async () => {
      if (!issueId) return [];
      const res = await fetch(`/api/comments/by-issue/${issueId}`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      return (await res.json()) as CommentItem[];
    }, enabled: !!issueId, refetchInterval: 5000, refetchIntervalInBackground: false,
  });
}

export function useCreateComment(issueId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(`/api/comments/by-issue/${issueId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      if (!res.ok) { const payload = await res.json().catch(() => null); throw new Error(payload?.message || 'Failed to post comment'); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['comments', issueId] }); queryClient.invalidateQueries({ queryKey: ['activities', issueId] }); },
    onError: err => toast.error('Failed to post comment', { description: (err as Error).message }),
  });
}

export function useUpdateComment(issueId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const response = await fetch(`/api/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      if (!response.ok) { const payload = await response.json().catch(() => null); throw new Error(payload?.message || 'Failed to update comment'); }
      return response.json() as Promise<CommentItem>;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['comments', issueId] }); queryClient.invalidateQueries({ queryKey: ['activities', issueId] }); toast.success('Comment updated'); },
    onError: error => toast.error('Could not update comment', { description: (error as Error).message }),
  });
}

export function useDeleteComment(issueId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
      if (!response.ok) { const payload = await response.json().catch(() => null); throw new Error(payload?.message || 'Failed to delete comment'); }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['comments', issueId] }); queryClient.invalidateQueries({ queryKey: ['activities', issueId] }); toast.success('Comment deleted'); },
    onError: error => toast.error('Could not delete comment', { description: (error as Error).message }),
  });
}

export function useIssueSubscription(issueId?: string) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['issue-subscription', issueId], queryFn: () => getIssueSubscription(issueId!), enabled: !!issueId });
  const mutation = useMutation({
    mutationFn: (subscribed: boolean) => setIssueSubscription(issueId!, subscribed),
    onSuccess: value => { queryClient.setQueryData(['issue-subscription', issueId], value); toast.success(value.subscribed ? 'Following issue' : 'Stopped following issue'); },
    onError: error => toast.error('Could not update subscription', { description: (error as Error).message }),
  });
  return { ...query, mutation };
}

export function useIssueAttachments(issueId?: string) {
  return useQuery({ queryKey: ['issue-attachments', issueId], queryFn: () => getIssueAttachments(issueId!), enabled: !!issueId, refetchInterval: 5000, refetchIntervalInBackground: false });
}
export function useIssueAttachmentMutations(issueId: string) {
  const queryClient = useQueryClient();
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['issue-attachments', issueId] }); queryClient.invalidateQueries({ queryKey: ['activities', issueId] }); };
  return {
    upload: useMutation({ mutationFn: (file: File) => uploadIssueAttachment(issueId, file), onSuccess: () => { refresh(); toast.success('Attachment uploaded'); }, onError: error => toast.error('Upload failed', { description: (error as Error).message }) }),
    remove: useMutation({ mutationFn: (id: string) => deleteIssueAttachment(id), onSuccess: () => { refresh(); toast.success('Attachment deleted'); }, onError: error => toast.error('Delete failed', { description: (error as Error).message }) }),
  };
}

export function useIssueRelations(issueId?: string) {
  return useQuery({ queryKey: ['issue-relations', issueId], queryFn: () => issueId ? getIssueRelations(issueId) : Promise.resolve([]), enabled: !!issueId });
}

export function useIssueRelationMutations(issueId: string) {
  const queryClient = useQueryClient();
  return {
    add: useMutation({
      mutationFn: ({ relatedIssueId, type }: { relatedIssueId: string; type: IssueRelation['type'] }) => addIssueRelation(issueId, relatedIssueId, type),
      onSuccess: relation => { queryClient.invalidateQueries({ queryKey: ['issue-relations', issueId] }); queryClient.invalidateQueries({ queryKey: ['issue-relations', relation.relatedIssue.id] }); queryClient.invalidateQueries({ queryKey: ['activities', issueId] }); toast.success('Issue relation added'); },
      onError: error => toast.error('Could not add issue relation', { description: (error as Error).message }),
    }),
    remove: useMutation({
      mutationFn: ({ relatedIssueId, type }: { relatedIssueId: string; type: IssueRelation['type'] }) => removeIssueRelation(issueId, relatedIssueId, type),
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['issue-relations', issueId] }); queryClient.invalidateQueries({ queryKey: ['activities', issueId] }); toast.success('Issue relation removed'); },
      onError: error => toast.error('Could not remove issue relation', { description: (error as Error).message }),
    }),
  };
}

export function useWorkspaceActivities(limit = 15) {
  return useQuery({
    queryKey: ['workspace-activities', limit],
    queryFn: async () => { const res = await fetch(`/api/activities`); if (!res.ok) throw new Error('Failed to fetch activities'); return (await res.json()) as ActivityItem[]; },
    refetchInterval: 15000, refetchIntervalInBackground: false,
  });
}

export function useIssueActivities(issueId?: string) {
  return useQuery({
    queryKey: ['activities', issueId],
    queryFn: async () => { if (!issueId) return []; const res = await fetch(`/api/activities/by-issue/${issueId}`); if (!res.ok) throw new Error('Failed to fetch activities'); return (await res.json()) as ActivityItem[]; },
    enabled: !!issueId, refetchInterval: 5000, refetchIntervalInBackground: false,
  });
}
