import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';
import { addProjectTeam, removeProjectTeam } from '../api/projects.api';
import { PROJECTS_QUERY_KEY } from './use-projects';

export const projectTeamsKey = (projectId: string) => ['projects', projectId, 'teams'] as const;

export function useAddProjectTeam(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => addProjectTeam(projectId, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectTeamsKey(projectId) });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
      toast.success('Team added to project');
    },
    onError: (error: Error) => {
      toast.error('Could not add team', { description: error.message });
    },
  });
}

export function useRemoveProjectTeam(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => removeProjectTeam(projectId, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectTeamsKey(projectId) });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
      toast.success('Team removed from project');
    },
    onError: (error: Error) => {
      toast.error('Could not remove team', { description: error.message });
    },
  });
}
