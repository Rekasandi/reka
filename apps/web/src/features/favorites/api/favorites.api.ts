export interface Favorite { resourceType: 'issue' | 'project' | 'document'; resourceId: string; name: string; href: string }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Request failed');
  return response.json();
}
const json = (method: string, body?: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const getFavorites = () => request<Favorite[]>('/api/favorites');
export const setFavorite = (resourceType: Favorite['resourceType'], resourceId: string, favorite: boolean) => favorite
  ? request('/api/favorites', json('POST', { resourceType, resourceId }))
  : request(`/api/favorites/${resourceType}/${resourceId}`, { method: 'DELETE' });
export interface SearchResults { issues: { id: string; identifier: string; title: string; status: string; teamId: string; projectId: string | null }[]; projects: { id: string; name: string; status: string; teamId: string }[]; documents: { id: string; title: string; projectId: string | null; teamId: string | null; updatedAt: string }[]; hasMore: boolean }
export const searchWorkspace = (query: string, offset = 0) => request<SearchResults>(`/api/search?q=${encodeURIComponent(query)}&limit=10&offset=${offset}`);
