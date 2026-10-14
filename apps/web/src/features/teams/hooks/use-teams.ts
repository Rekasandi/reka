import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  addTeamMember,
  removeTeamMember,
  updateTeamMember,
  joinTeam,
  deleteTeam,
  type CreateTeamInput,
  type UpdateTeamInput,
  type AddTeamMemberInput,
  getTeamWorkflowStates,
  updateTeamWorkflowStates,
  type TeamWorkflowState,
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

export function useTeamWorkflowStates(teamId?: string) {
  return useQuery({
    queryKey: ['team-workflow-states', teamId],
    queryFn: () => teamId ? getTeamWorkflowStates(teamId) : Promise.resolve([]),
    enabled: !!teamId,
  });
}

export function useUpdateTeamWorkflowStates(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (states: Omit<TeamWorkflowState, 'teamId'>[]) => updateTeamWorkflowStates(teamId, states),
    onSuccess: (states) => {
      queryClient.setQueryData(['team-workflow-states', teamId], states);
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      toast.success('Team workflow updated');
    },
    onError: (error) => toast.error('Could not update workflow', { description: (error as Error).message }),
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
      queryClient.invalidateQueries({ queryKey: ['issues'] });
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

export function useUpdateTeamMember(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'lead' | 'member' | 'viewer' }) => updateTeamMember(teamId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      toast.success('Team role updated');
    },
    onError: (error) => toast.error('Could not update team role', { description: error.message }),
  });
}

export function useJoinTeam(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => joinTeam(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      toast.success('Joined team');
    },
    onError: error => toast.error('Could not join team', { description: error.message }),
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
