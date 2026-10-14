import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  type CreateUserInput,
  type UpdateUserInput,
} from '../api/users.api';
import { toast } from '@reka/ui';
import { useAuthStore } from '../../../stores/auth.store';

export const USERS_QUERY_KEY = ['users'];

export function useUsers(includeInactive = false) {
  return useQuery({
    queryKey: includeInactive ? [...USERS_QUERY_KEY, 'including-inactive'] : USERS_QUERY_KEY,
    queryFn: () => getUsers(includeInactive),
  });
}

export function useUser(id?: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => (id ? getUserById(id) : null),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast.success(`Profile "${newUser.name}" saved. An invitation is required to join.`);
    },
    onError: (err) => {
      toast.error('Failed to create user', {
        description: (err as Error).message,
      });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      updateUser(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['user', updated.id] });
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      const current = useAuthStore.getState().user;
      if (current?.id === updated.id) useAuthStore.getState().setUser({ ...current, name: updated.name, role: updated.role });
      toast.info(`User "${updated.name}" updated`);
    },
    onError: (err) => {
      toast.error('Failed to update user', {
        description: (err as Error).message,
      });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast.success('User deactivated. Authored work is preserved.');
    },
    onError: (err) => {
      toast.error('Failed to delete user', {
        description: (err as Error).message,
      });
    },
  });
}
