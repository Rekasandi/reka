import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';

export interface GithubPullRequest {
  id: string;
  repositoryId: string;
  issueId?: string | null;
  prNumber: number;
  title: string;
  state: 'open' | 'closed';
  merged: boolean;
  branchName: string;
  htmlUrl: string;
  ciStatus?: 'pending' | 'success' | 'failure';
  reviewStatus?: 'none' | 'changes_requested' | 'approved';
  deployEnv?: string;
  deployUrl?: string;
  releaseTag?: string;
  createdAt: string;
  updatedAt: string;
}

export function useIssuePullRequests(issueId?: string) {
  return useQuery<GithubPullRequest[]>({
    queryKey: ['github-prs', issueId],
    queryFn: async () => {
      if (!issueId) return [];
      const res = await fetch(`/api/integrations/github/pull-requests/by-issue/${issueId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!issueId,
  });
}

export function useLinkPullRequest(issueId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      prNumber: number;
      title: string;
      branchName: string;
      htmlUrl: string;
      merged?: boolean;
      ciStatus?: 'pending' | 'success' | 'failure';
      reviewStatus?: 'none' | 'changes_requested' | 'approved';
      deployEnv?: string;
      deployUrl?: string;
      releaseTag?: string;
    }) => {
      const res = await fetch('/api/integrations/github/pull-requests/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          issueId,
        }),
      });
      if (!res.ok) throw new Error('Failed to link pull request');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['github-prs', issueId] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['activities', issueId] });
      toast.success(`GitHub PR #${data.prNumber} linked`, {
        description: data.merged ? 'Issue automatically closed to Done.' : 'Status moved to In Review.',
      });
    },
    onError: (err: any) => {
      toast.error('Failed to link GitHub PR', {
        description: err.message,
      });
    },
  });
}

export function useSyncBranch(issueId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ branchName, issueIdentifier }: { branchName: string; issueIdentifier: string }) => {
      const res = await fetch('/api/integrations/github/pull-requests/sync-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchName, issueIdentifier }),
      });
      if (!res.ok) throw new Error('Failed to sync branch');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['activities', issueId] });
      toast.info('Issue moved to In Progress (Branch Active)');
    },
  });
}
