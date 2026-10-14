export type SavedViewConfig = {
  filterTab: 'all' | 'active' | 'backlog' | 'done' | 'archived';
  viewMode: 'grouped' | 'list' | 'board';
  groupBy: 'status' | 'none';
  sortBy: 'manual' | 'updated' | 'priority' | 'dueDate';
  showSubtasks: boolean;
  filters: { assigneeIds: string[]; labelIds: string[]; priorities: string[]; projectIds: string[] };
};
export interface SavedView {
  id: string; name: string; teamId: string | null; ownerId: string;
  visibility: 'private' | 'shared'; config: SavedViewConfig; canEdit?: boolean;
}
export interface Favorite { resourceType: 'issue' | 'project' | 'view' | 'document'; resourceId: string; name: string; href: string }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Request failed');
  return response.json();
}
const json = (method: string, body?: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const getSavedViews = (teamId?: string) => request<SavedView[]>(`/api/views${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''}`);
export const createSavedView = (input: Omit<SavedView, 'id' | 'ownerId' | 'canEdit'>) => request<SavedView>('/api/views', json('POST', input));
export const updateSavedView = (id: string, input: Partial<Pick<SavedView, 'name' | 'visibility' | 'config'>>) => request<SavedView>(`/api/views/${id}`, json('PATCH', input));
export const deleteSavedView = (id: string) => request<{ success: boolean }>(`/api/views/${id}`, { method: 'DELETE' });
export const getFavorites = () => request<Favorite[]>('/api/favorites');
export const setFavorite = (resourceType: Favorite['resourceType'], resourceId: string, favorite: boolean) => favorite
  ? request('/api/favorites', json('POST', { resourceType, resourceId }))
  : request(`/api/favorites/${resourceType}/${resourceId}`, { method: 'DELETE' });
export interface SearchResults { issues: { id: string; identifier: string; title: string; status: string; teamId: string; projectId: string | null }[]; projects: { id: string; name: string; status: string; teamId: string }[]; documents: { id: string; title: string; projectId: string | null; teamId: string | null; updatedAt: string }[]; hasMore: boolean }
export const searchWorkspace = (query: string, offset = 0) => request<SearchResults>(`/api/search?q=${encodeURIComponent(query)}&limit=10&offset=${offset}`);
