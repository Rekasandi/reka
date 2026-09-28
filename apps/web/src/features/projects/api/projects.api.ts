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

export interface CreateProjectInput {
  teamId: string;
  name: string;
  description?: string;
  status?: string;
  health?: string;
  priority?: string;
  targetDate?: string;
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
