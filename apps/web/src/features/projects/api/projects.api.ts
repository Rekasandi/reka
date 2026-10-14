import type { EntityIconName } from '@reka/types';

export interface ProjectRepository {
  id: string;
  repoId?: number;
  fullName: string;
  name: string;
  owner: string;
  isPrivate: boolean;
  defaultBranch: string;
  createdAt?: string;
}

export interface Project {
  id: string;
  organizationId: string;
  teamId: string;
  clientId?: string | null;
  name: string;
  icon?: EntityIconName | null;
  slug: string;
  description?: string | null;
  status: 'planned' | 'in_progress' | 'paused' | 'completed' | 'canceled';
  health: 'on_track' | 'at_risk' | 'off_track';
  priority: 'no_priority' | 'low' | 'medium' | 'high' | 'urgent';
  ownerId: string;
  startDate?: string | null;
  targetDate?: string | null;
  totalIssues?: number;
  completedIssues?: number;
  progress?: number;
  repositories?: ProjectRepository[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMilestone {
  id: string; projectId: string; name: string; description: string | null; targetDate: string | null;
  position: number; totalIssues: number; completedIssues: number; progress: number; isComplete: boolean;
}
export interface ProjectUpdate {
  id: string; projectId: string; authorId: string; authorName?: string; authorAvatarUrl?: string | null;
  health: Project['health']; body: string; createdAt: string; updatedAt: string;
}
export interface ProjectDependencyItem { id: string; name: string; status: Project['status']; targetDate: string | null }
export interface ProjectDependencies { dependsOn: ProjectDependencyItem[]; blockedBy: ProjectDependencyItem[] }

export interface CreateProjectInput {
  teamId: string;
  name: string;
  icon?: EntityIconName | null;
  description?: string;
  status?: string;
  health?: string;
  priority?: string;
  ownerId?: string;
  startDate?: string | null;
  targetDate?: string | null;
}

export async function getProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
}

export async function getProjectById(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) throw new Error('Failed to fetch project');
  return res.json();
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to create project');
  return res.json();
}

export async function updateProject(id: string, input: Partial<CreateProjectInput>): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to update project');
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete project');
}

export async function getProjectRepositories(projectId: string): Promise<ProjectRepository[]> {
  const res = await fetch(`/api/projects/${projectId}/repositories`);
  if (!res.ok) throw new Error('Failed to fetch project repositories');
  return res.json();
}

export async function linkProjectRepository(projectId: string, repositoryId: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/projects/${projectId}/repositories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repositoryId }),
  });
  if (!res.ok) throw new Error('Failed to link repository to project');
  return res.json();
}

export async function unlinkProjectRepository(projectId: string, repositoryId: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/projects/${projectId}/repositories/${repositoryId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to unlink repository from project');
  return res.json();
}

async function workflowRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(path, { method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || 'Project request failed');
  return res.json();
}
const projectPath = (id: string, suffix: string) => `/api/projects/${encodeURIComponent(id)}/${suffix}`;
export const getProjectMilestones = (id: string) => workflowRequest<ProjectMilestone[]>(projectPath(id, 'milestones'));
export const createProjectMilestone = (id: string, input: { name: string; description?: string; targetDate?: string }) => workflowRequest<ProjectMilestone>(projectPath(id, 'milestones'), 'POST', input);
export const updateProjectMilestone = (id: string, milestoneId: string, input: Partial<{ name: string; description: string | null; targetDate: string | null; position: number }>) => workflowRequest<ProjectMilestone>(projectPath(id, `milestones/${milestoneId}`), 'PATCH', input);
export const deleteProjectMilestone = (id: string, milestoneId: string) => workflowRequest<{ success: boolean }>(projectPath(id, `milestones/${milestoneId}`), 'DELETE');
export const assignIssueMilestone = (id: string, milestoneId: string, issueId: string) => workflowRequest('/api/projects/' + encodeURIComponent(id) + `/milestones/${encodeURIComponent(milestoneId)}/issues/${encodeURIComponent(issueId)}`, 'POST');
export const unassignIssueMilestone = (id: string, milestoneId: string, issueId: string) => workflowRequest('/api/projects/' + encodeURIComponent(id) + `/milestones/${encodeURIComponent(milestoneId)}/issues/${encodeURIComponent(issueId)}`, 'DELETE');
export const getProjectDependencies = (id: string) => workflowRequest<ProjectDependencies>(projectPath(id, 'dependencies'));
export const addProjectDependency = (id: string, dependsOnProjectId: string) => workflowRequest(projectPath(id, 'dependencies'), 'POST', { dependsOnProjectId });
export const removeProjectDependency = (id: string, dependsOnProjectId: string) => workflowRequest<{ success: boolean }>(projectPath(id, `dependencies/${dependsOnProjectId}`), 'DELETE');
export const getProjectUpdates = (id: string) => workflowRequest<ProjectUpdate[]>(projectPath(id, 'updates'));
export const getProjectUpdateSubscription = (id: string) => workflowRequest<{ subscribed: boolean }>(projectPath(id, 'update-subscription'));
export const setProjectUpdateSubscription = (id: string, subscribed: boolean) => workflowRequest<{ subscribed: boolean }>(projectPath(id, 'update-subscription'), subscribed ? 'POST' : 'DELETE');
export const createProjectUpdate = (id: string, input: { body: string; health: Project['health'] }) => workflowRequest<ProjectUpdate>(projectPath(id, 'updates'), 'POST', input);
export const updateProjectUpdate = (id: string, updateId: string, input: Partial<{ body: string; health: Project['health'] }>) => workflowRequest<ProjectUpdate>(projectPath(id, `updates/${updateId}`), 'PATCH', input);
