import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCycles,
  getCycleById,
  createCycle,
  updateCycle,
  completeCycle,
  deleteCycle,
  reopenCycle,
  getCycleHistory,
  getTeamCycleSettings,
  saveTeamCycleSettings,
  type CreateCycleInput,
  type UpdateCycleInput,
  type CompleteCycleInput,
  type TeamCycleSettings,
} from '../api/cycles.api';
import { toast } from '@reka/ui';

export const CYCLES_QUERY_KEY = ['cycles'];

export function useCycles() {
  return useQuery({
    queryKey: CYCLES_QUERY_KEY,
    queryFn: getCycles,
  });
}

export function useCycleHistory(id?: string) {
  return useQuery({ queryKey: ['cycle-history', id], queryFn: () => getCycleHistory(id!), enabled: !!id });
}

export function useTeamCycleSettings(teamId?: string) {
  return useQuery({ queryKey: ['cycle-settings', teamId], queryFn: () => getTeamCycleSettings(teamId!), enabled: !!teamId });
}

export function useCycle(id?: string) {
  return useQuery({
    queryKey: ['cycle', id],
    queryFn: () => (id ? getCycleById(id) : null),
    enabled: !!id,
  });
}

export function useCreateCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCycleInput) => createCycle(input),
    onSuccess: (newCycle) => {
      queryClient.invalidateQueries({ queryKey: CYCLES_QUERY_KEY });
      toast.success(`Cycle "${newCycle.name}" created`);
    },
    onError: (err) => {
      toast.error('Failed to create cycle', {
        description: (err as Error).message,
      });
    },
  });
}

export function useUpdateCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCycleInput }) =>
      updateCycle(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: CYCLES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['cycle', updated.id] });
      toast.info(`Cycle "${updated.name}" updated`);
    },
    onError: (err) => {
      toast.error('Failed to update cycle', {
        description: (err as Error).message,
      });
    },
  });
}

export function useCompleteCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CompleteCycleInput }) =>
      completeCycle(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: CYCLES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['cycle'] });
      queryClient.invalidateQueries({ queryKey: ['cycle-history'] });
      toast.success('Cycle ended', {
        description: `${res.rolledOverCount} incomplete issues moved.`,
      });
    },
    onError: (err) => {
      toast.error('Failed to end cycle', {
        description: (err as Error).message,
      });
    },
  });
}

export function useReopenCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reopenCycle(id),
    onSuccess: (_, id) => { queryClient.invalidateQueries({ queryKey: CYCLES_QUERY_KEY }); queryClient.invalidateQueries({ queryKey: ['cycle', id] }); toast.success('Cycle reopened'); },
    onError: (err) => toast.error('Failed to reopen cycle', { description: (err as Error).message }),
  });
}

export function useSaveTeamCycleSettings(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: Omit<TeamCycleSettings, 'teamId' | 'updatedBy' | 'createdAt' | 'updatedAt'>) => saveTeamCycleSettings(teamId, settings),
    onSuccess: (settings) => { queryClient.setQueryData(['cycle-settings', teamId], settings); queryClient.invalidateQueries({ queryKey: CYCLES_QUERY_KEY }); toast.success('Cycle schedule saved'); },
    onError: (err) => toast.error('Failed to save cycle schedule', { description: (err as Error).message }),
  });
}

export function useDeleteCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCycle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CYCLES_QUERY_KEY });
      toast.success('Cycle deleted');
    },
    onError: (err) => {
      toast.error('Failed to delete cycle', {
        description: (err as Error).message,
      });
    },
  });
}
