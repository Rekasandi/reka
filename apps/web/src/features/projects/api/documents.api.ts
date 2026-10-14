export interface ProjectDocument {
  id: string; organizationId: string; projectId: string | null; teamId: string | null; title: string; content: string;
  createdBy: string; updatedBy: string; archivedAt: string | null; createdAt: string; updatedAt: string;
}
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Document request failed');
  return response.json();
}
export const getDocuments = (scope: { projectId?: string; teamId?: string } = {}, includeArchived = false) => {
  const params = new URLSearchParams();
  if (scope.projectId) params.set('projectId', scope.projectId);
  if (scope.teamId) params.set('teamId', scope.teamId);
  if (includeArchived) params.set('includeArchived', 'true');
  return request<ProjectDocument[]>(`/api/documents${params.size ? `?${params}` : ''}`);
};
export const getDocument = (id: string) => request<ProjectDocument>(`/api/documents/${encodeURIComponent(id)}`);
export const createDocument = (input: { title: string; content: string; projectId?: string; teamId?: string }) => request<ProjectDocument>('/api/documents', 'POST', input);
export const updateDocument = (id: string, input: { title?: string; content?: string }) => request<ProjectDocument>(`/api/documents/${encodeURIComponent(id)}`, 'PATCH', input);
export const archiveDocument = (id: string) => request<ProjectDocument>(`/api/documents/${encodeURIComponent(id)}/archive`, 'POST');
export const restoreDocument = (id: string) => request<ProjectDocument>(`/api/documents/${encodeURIComponent(id)}/restore`, 'POST');
