import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  type CreateProjectInput,
} from '../api/projects.api';
import { toast } from '@reka/ui';

export const PROJECTS_QUERY_KEY = ['projects'];

export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: getProjects,
  });
}

export function useProject(id?: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => (id ? getProjectById(id) : null),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
      toast.success(`Project "${newProject.name}" created`);
    },
    onError: (err) => {
      toast.error('Failed to create project', {
        description: (err as Error).message,
      });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateProjectInput> }) =>
      updateProject(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
      toast.info(`Project "${updated.name}" updated`);
    },
    onError: (err) => {
      toast.error('Failed to update project', {
        description: (err as Error).message,
      });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
      toast.success('Project deleted');
    },
    onError: (err) => {
      toast.error('Failed to delete project', {
        description: (err as Error).message,
      });
    },
  });
}
