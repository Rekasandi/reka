import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';

export interface GithubRepository {
  id: string;
  fullName: string;
  isPrivate: boolean;
}

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

export function useIssueGithubRepositories(issueId?: string) {
  return useQuery<GithubRepository[]>({
    queryKey: ['github-issue-repositories', issueId],
    queryFn: async () => {
      if (!issueId) return [];
      const res = await fetch(`/api/integrations/github/pull-requests/repositories/by-issue/${issueId}`);
      if (!res.ok) throw new Error('Could not load repositories linked to this issue');
      return res.json();
    },
    enabled: !!issueId,
  });
}

export interface GithubBranch {
  id: string; issueId?: string | null; name: string; sha: string; repositoryName: string; createdAt: string;
}

export function useIssueBranches(issueId?: string) {
  return useQuery<GithubBranch[]>({
    queryKey: ['github-branches', issueId],
    queryFn: async () => {
      const response = await fetch(`/api/integrations/github/pull-requests/branches/by-issue/${issueId}`);
      if (!response.ok) throw new Error('Could not load linked GitHub branches');
      return response.json();
    }, enabled: !!issueId, refetchInterval: 5000, refetchIntervalInBackground: false,
  });
}

export function useIssuePullRequests(issueId?: string) {
  return useQuery<GithubPullRequest[]>({
    queryKey: ['github-prs', issueId],
    queryFn: async () => {
      if (!issueId) return [];
      const res = await fetch(`/api/integrations/github/pull-requests/by-issue/${issueId}`);
      if (!res.ok) throw new Error('Failed to load pull requests');
      return res.json();
    },
    enabled: !!issueId,
  });
}

export function useLinkPullRequest(issueId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { repositoryId: string; prNumber: number }) => {
      const res = await fetch('/api/integrations/github/pull-requests/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          issueId,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        const message = error?.message;
        throw new Error(Array.isArray(message) ? message.join(', ') : message || 'Could not verify this pull request');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['github-prs', issueId] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['activities', issueId] });
      queryClient.invalidateQueries({ queryKey: ['github-branches', issueId] });
      const description = data.merged ? 'Verified merge moved the issue to a completed workflow state.'
        : data.state === 'closed' ? 'PR linked as closed without merge; issue status was not changed.'
        : 'Verified open PR moved the issue into an active workflow state.';
      toast.success(`GitHub PR #${data.prNumber} linked`, { description });
    },
    onError: (err: any) => {
      toast.error('Failed to link GitHub PR', {
        description: err.message,
      });
    },
  });
}
