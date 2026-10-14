import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';
import { addInitiativeProject, createInitiative, deleteInitiative, getInitiative, getInitiatives, getRoadmap, removeInitiativeProject, updateInitiative, type InitiativeInput } from '../api/initiatives.api';

const keys = { list: ['initiatives'] as const, detail: (id?: string) => ['initiative', id] as const, roadmap: ['roadmap'] as const };
const refresh = (client: ReturnType<typeof useQueryClient>) => {
  void client.invalidateQueries({ queryKey: keys.list });
  void client.invalidateQueries({ queryKey: ['initiative'] });
  void client.invalidateQueries({ queryKey: keys.roadmap });
};

export const useInitiatives = () => useQuery({ queryKey: keys.list, queryFn: getInitiatives });
export const useInitiative = (id?: string) => useQuery({ queryKey: keys.detail(id), queryFn: () => getInitiative(id!), enabled: !!id });
export const useRoadmap = () => useQuery({ queryKey: keys.roadmap, queryFn: getRoadmap });

export function useCreateInitiative() {
  const client = useQueryClient();
  return useMutation({ mutationFn: createInitiative, onSuccess: (item) => { refresh(client); toast.success(`Initiative “${item.name}” created`); }, onError: (error: Error) => toast.error('Could not create initiative', { description: error.message }) });
}

export function useUpdateInitiative(id: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: Partial<InitiativeInput>) => updateInitiative(id, input), onSuccess: (item) => { refresh(client); client.setQueryData(keys.detail(id), item); toast.success('Initiative updated'); }, onError: (error: Error) => toast.error('Could not update initiative', { description: error.message }) });
}

export function useDeleteInitiative() {
  const client = useQueryClient();
  return useMutation({ mutationFn: deleteInitiative, onSuccess: () => { refresh(client); toast.success('Initiative deleted'); }, onError: (error: Error) => toast.error('Could not delete initiative', { description: error.message }) });
}

export function useInitiativeProject(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, add }: { projectId: string; add: boolean }) => add ? addInitiativeProject(id, projectId) : removeInitiativeProject(id, projectId),
    onSuccess: (item) => { refresh(client); client.setQueryData(keys.detail(id), item); toast.success('Initiative projects updated'); },
    onError: (error: Error) => toast.error('Could not update initiative projects', { description: error.message }),
  });
}
