import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';
import { createSavedView, deleteSavedView, getFavorites, getSavedViews, setFavorite, updateSavedView, type Favorite, type SavedView } from '../api/views.api';

export const useSavedViews = (teamId?: string) => useQuery({ queryKey: ['saved-views', teamId ?? 'all'], queryFn: () => getSavedViews(teamId) });
export const useFavorites = () => useQuery({ queryKey: ['favorites'], queryFn: getFavorites });
function invalidate(client: ReturnType<typeof useQueryClient>) {
  client.invalidateQueries({ queryKey: ['saved-views'] }); client.invalidateQueries({ queryKey: ['favorites'] });
}
export function useCreateSavedView() {
  const client = useQueryClient();
  return useMutation({ mutationFn: createSavedView, onSuccess: () => { invalidate(client); toast.success('View saved'); }, onError: error => toast.error('Could not save view', { description: error.message }) });
}
export function useUpdateSavedView() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<Pick<SavedView, 'name' | 'visibility' | 'config'>> }) => updateSavedView(id, input), onSuccess: () => { invalidate(client); toast.success('View updated'); }, onError: error => toast.error('Could not update view', { description: error.message }) });
}
export function useDeleteSavedView() {
  const client = useQueryClient();
  return useMutation({ mutationFn: deleteSavedView, onSuccess: () => { invalidate(client); toast.success('View deleted'); }, onError: error => toast.error('Could not delete view', { description: error.message }) });
}
export function useToggleFavorite() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ resourceType, resourceId, favorite }: { resourceType: Favorite['resourceType']; resourceId: string; favorite: boolean }) => setFavorite(resourceType, resourceId, favorite), onSuccess: () => client.invalidateQueries({ queryKey: ['favorites'] }), onError: error => toast.error('Could not update favorite', { description: error.message }) });
}
