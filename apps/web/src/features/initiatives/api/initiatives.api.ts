export type InitiativeStatus = 'planned' | 'in_progress' | 'completed' | 'canceled';
export type InitiativeHealth = 'on_track' | 'at_risk' | 'off_track';
export interface InitiativeProject {
  id: string; name: string; status: string; health: string; startDate: string | null; targetDate: string | null;
  totalIssues: number; completedIssues: number; progress: number | null;
}
export interface Initiative {
  id: string; organizationId: string; name: string; description: string; status: InitiativeStatus; health: InitiativeHealth;
  ownerId: string; startDate: string | null; targetDate: string | null; createdAt: string; updatedAt: string;
  projects: InitiativeProject[]; projectCount: number; totalIssues: number; completedIssues: number; progress: number | null;
}
export interface RoadmapProject extends InitiativeProject { teamId: string; scheduled: boolean }
export interface RoadmapData {
  initiatives: Initiative[];
  projects: RoadmapProject[];
  milestones: { id: string; projectId: string; projectName: string; name: string; targetDate: string | null }[];
  dependencies: { projectId: string; dependsOnProjectId: string; projectName: string; dependsOnProjectName: string }[];
}
export interface InitiativeInput {
  name: string; description?: string; status?: InitiativeStatus; health?: InitiativeHealth;
  startDate?: string | null; targetDate?: string | null;
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message || 'Initiative request failed');
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

const base = '/initiatives';
export const getInitiatives = () => request<Initiative[]>(base);
export const getInitiative = (id: string) => request<Initiative>(`${base}/${encodeURIComponent(id)}`);
export const createInitiative = (input: InitiativeInput) => request<Initiative>(base, 'POST', input);
export const updateInitiative = (id: string, input: Partial<InitiativeInput>) => request<Initiative>(`${base}/${encodeURIComponent(id)}`, 'PATCH', input);
export const deleteInitiative = (id: string) => request<{ success: boolean }>(`${base}/${encodeURIComponent(id)}`, 'DELETE');
export const addInitiativeProject = (id: string, projectId: string) => request<Initiative>(`${base}/${encodeURIComponent(id)}/projects`, 'POST', { projectId });
export const removeInitiativeProject = (id: string, projectId: string) => request<Initiative>(`${base}/${encodeURIComponent(id)}/projects/${encodeURIComponent(projectId)}`, 'DELETE');
export const getRoadmap = () => request<RoadmapData>(`${base}/roadmap`);
