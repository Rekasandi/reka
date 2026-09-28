import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';
import {
  getProjectRepositories,
  linkProjectRepository,
  unlinkProjectRepository,
  type ProjectRepository,
} from '../api/projects.api';

export const projectReposKey = (projectId: string) => ['projects', projectId, 'repositories'];

export function useProjectRepositories(projectId: string | undefined) {
  return useQuery<ProjectRepository[]>({
    queryKey: projectReposKey(projectId || ''),
    queryFn: () => getProjectRepositories(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useLinkProjectRepository(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (repositoryId: string) => linkProjectRepository(projectId!, repositoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectReposKey(projectId || '') });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Repository linked to project');
    },
    onError: (err: Error) => {
      toast.error('Failed to link repository: ' + err.message);
    },
  });
}

export function useUnlinkProjectRepository(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (repositoryId: string) => unlinkProjectRepository(projectId!, repositoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectReposKey(projectId || '') });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Repository unlinked from project');
    },
    onError: (err: Error) => {
      toast.error('Failed to unlink repository: ' + err.message);
    },
  });
}
