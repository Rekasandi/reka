import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';

export interface GithubRepository {
  id: string;
  installationId: string;
  repoId: number;
  owner: string;
  name: string;
  fullName: string;
  isPrivate: boolean;
  defaultBranch: string;
  createdAt: string;
}

export interface AvailableRepository {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  defaultBranch: string;
  isPrivate: boolean;
  description?: string;
}

export const GITHUB_REPOS_KEY = ['github-repos'];

export function useGithubRepositories() {
  return useQuery<GithubRepository[]>({
    queryKey: GITHUB_REPOS_KEY,
    queryFn: async () => {
      const res = await fetch('/api/integrations/github/repositories');
      if (!res.ok) return [];
      return res.json();
    },
  });
}

export function useAvailableGithubRepositories() {
  return useQuery<AvailableRepository[]>({
    queryKey: ['github-available-repos'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/github/repositories/available');
      if (!res.ok) return [];
      return res.json();
    },
  });
}

export function useAddGithubRepository() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { fullName: string; defaultBranch?: string; isPrivate?: boolean }) => {
      const res = await fetch('/api/integrations/github/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to connect repository');
      }
      return res.json();
    },
    onSuccess: (newRepo) => {
      queryClient.invalidateQueries({ queryKey: GITHUB_REPOS_KEY });
      toast.success(`Repository ${newRepo.fullName} connected`);
    },
    onError: (err: any) => {
      toast.error('Failed to add repository', {
        description: err.message,
      });
    },
  });
}

export function useDeleteGithubRepository() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/integrations/github/repositories/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to disconnect repository');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GITHUB_REPOS_KEY });
      toast.success('Repository disconnected');
    },
    onError: (err: any) => {
      toast.error('Failed to disconnect repository', {
        description: err.message,
      });
    },
  });
}
