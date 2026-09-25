import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  addTeamMember,
  removeTeamMember,
  deleteTeam,
  type CreateTeamInput,
  type UpdateTeamInput,
  type AddTeamMemberInput,
} from '../api/teams.api';
import { toast } from '@reka/ui';

export const TEAMS_QUERY_KEY = ['teams'];

export function useTeams() {
  return useQuery({
    queryKey: TEAMS_QUERY_KEY,
    queryFn: getTeams,
  });
}

export function useTeam(id?: string) {
  return useQuery({
    queryKey: ['team', id],
    queryFn: () => (id ? getTeamById(id) : null),
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTeamInput) => createTeam(input),
    onSuccess: (newTeam) => {
      queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY });
      toast.success(`Team "${newTeam.name}" (${newTeam.key}) created`);
    },
    onError: (err) => {
      toast.error('Failed to create team', {
        description: (err as Error).message,
      });
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTeamInput }) =>
      updateTeam(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['team', updated.id] });
      toast.info(`Team "${updated.name}" updated`);
    },
    onError: (err) => {
      toast.error('Failed to update team', {
        description: (err as Error).message,
      });
    },
  });
}

export function useAddTeamMember(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddTeamMemberInput) => addTeamMember(teamId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      toast.success('Team member added');
    },
    onError: (err) => {
      toast.error('Failed to add member', {
        description: (err as Error).message,
      });
    },
  });
}

export function useRemoveTeamMember(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => removeTeamMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      toast.success('Member removed from team');
    },
    onError: (err) => {
      toast.error('Failed to remove member', {
        description: (err as Error).message,
      });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTeam(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY });
      toast.success('Team deleted');
    },
    onError: (err) => {
      toast.error('Failed to delete team', {
        description: (err as Error).message,
      });
    },
  });
}
