import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';
import {
  addProjectDependency, assignIssueMilestone, createProjectMilestone, createProjectUpdate,
  deleteProjectMilestone, getProjectDependencies, getProjectMilestones, getProjectUpdates,
  removeProjectDependency, unassignIssueMilestone, updateProjectMilestone, updateProjectUpdate,
  getProjectUpdateSubscription, setProjectUpdateSubscription,
} from '../api/projects.api';

const invalidateProject = (client: ReturnType<typeof useQueryClient>, id: string) => {
  client.invalidateQueries({ queryKey: ['project', id] });
  client.invalidateQueries({ queryKey: ['projects'] });
  client.invalidateQueries({ queryKey: ['project-milestones', id] });
  client.invalidateQueries({ queryKey: ['project-dependencies', id] });
  client.invalidateQueries({ queryKey: ['project-updates', id] });
  client.invalidateQueries({ queryKey: ['project-update-subscription', id] });
  client.invalidateQueries({ queryKey: ['issues'] });
  client.invalidateQueries({ queryKey: ['documents'] });
};

export const useProjectMilestones = (id?: string) => useQuery({ queryKey: ['project-milestones', id], queryFn: () => getProjectMilestones(id!), enabled: !!id });
export const useProjectDependencies = (id?: string) => useQuery({ queryKey: ['project-dependencies', id], queryFn: () => getProjectDependencies(id!), enabled: !!id });
export const useProjectUpdates = (id?: string) => useQuery({ queryKey: ['project-updates', id], queryFn: () => getProjectUpdates(id!), enabled: !!id });
export const useProjectUpdateSubscription = (id?: string) => useQuery({ queryKey: ['project-update-subscription', id], queryFn: () => getProjectUpdateSubscription(id!), enabled: !!id });

export function useSetProjectUpdateSubscription(id: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (subscribed: boolean) => setProjectUpdateSubscription(id, subscribed), onSuccess: () => { client.invalidateQueries({ queryKey: ['project-update-subscription', id] }); toast.success('Update subscription changed'); }, onError: error => toast.error('Could not update subscription', { description: error.message }) });
}

export function useCreateProjectMilestone(id: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: { name: string; description?: string; targetDate?: string }) => createProjectMilestone(id, input), onSuccess: () => { invalidateProject(client, id); toast.success('Milestone created'); }, onError: error => toast.error('Could not create milestone', { description: error.message }) });
}
export function useUpdateProjectMilestone(id: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ milestoneId, input }: { milestoneId: string; input: Parameters<typeof updateProjectMilestone>[2] }) => updateProjectMilestone(id, milestoneId, input), onSuccess: () => invalidateProject(client, id), onError: error => toast.error('Could not update milestone', { description: error.message }) });
}
export function useDeleteProjectMilestone(id: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (milestoneId: string) => deleteProjectMilestone(id, milestoneId), onSuccess: () => { invalidateProject(client, id); toast.success('Milestone deleted'); }, onError: error => toast.error('Could not delete milestone', { description: error.message }) });
}
export function useAssignIssueMilestone(id: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ milestoneId, issueId, assigned }: { milestoneId: string; issueId: string; assigned: boolean }) => assigned ? assignIssueMilestone(id, milestoneId, issueId) : unassignIssueMilestone(id, milestoneId, issueId), onSuccess: () => invalidateProject(client, id), onError: error => toast.error('Could not change milestone assignment', { description: error.message }) });
}
export function useAddProjectDependency(id: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (dependsOnProjectId: string) => addProjectDependency(id, dependsOnProjectId), onSuccess: () => { invalidateProject(client, id); toast.success('Project dependency added'); }, onError: error => toast.error('Could not add dependency', { description: error.message }) });
}
export function useRemoveProjectDependency(id: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (dependsOnProjectId: string) => removeProjectDependency(id, dependsOnProjectId), onSuccess: () => { invalidateProject(client, id); toast.success('Dependency removed'); }, onError: error => toast.error('Could not remove dependency', { description: error.message }) });
}
export function useCreateProjectUpdate(id: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: { body: string; health: 'on_track' | 'at_risk' | 'off_track' }) => createProjectUpdate(id, input), onSuccess: () => { invalidateProject(client, id); toast.success('Project update posted'); }, onError: error => toast.error('Could not post update', { description: error.message }) });
}
export function useUpdateProjectUpdate(id: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ updateId, input }: { updateId: string; input: Parameters<typeof updateProjectUpdate>[2] }) => updateProjectUpdate(id, updateId, input), onSuccess: () => invalidateProject(client, id), onError: error => toast.error('Could not edit update', { description: error.message }) });
}
