import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';
import { getFavorites, setFavorite, type Favorite } from '../api/favorites.api';

export const useFavorites = () => useQuery({ queryKey: ['favorites'], queryFn: getFavorites });
export function useToggleFavorite() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ resourceType, resourceId, favorite }: { resourceType: Favorite['resourceType']; resourceId: string; favorite: boolean }) => setFavorite(resourceType, resourceId, favorite), onSuccess: () => client.invalidateQueries({ queryKey: ['favorites'] }), onError: error => toast.error('Could not update favorite', { description: error.message }) });
}
