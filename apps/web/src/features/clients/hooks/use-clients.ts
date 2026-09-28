import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientContacts,
  addClientContact,
  deleteClientContact,
  seedDemoClients,
  type CreateClientInput,
  type CreateContactInput,
} from '../api/clients.api';
import { toast } from '@reka/ui';

export const CLIENTS_QUERY_KEY = ['clients'];

export function useClients() {
  return useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: getClients,
  });
}

export function useClient(id?: string) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: () => (id ? getClientById(id) : null),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClientInput) => createClient(input),
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY });
      toast.success(`Client "${newClient.name}" created`);
    },
    onError: (err) => {
      toast.error('Failed to create client', {
        description: (err as Error).message,
      });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateClientInput> }) =>
      updateClient(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['client', updated.id] });
      toast.info(`Updated "${updated.name}"`);
    },
    onError: (err) => {
      toast.error('Failed to update client', {
        description: (err as Error).message,
      });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY });
      toast.success('Client deleted');
    },
    onError: (err) => {
      toast.error('Failed to delete client', {
        description: (err as Error).message,
      });
    },
  });
}

export function useClientContacts(clientId?: string) {
  return useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: () => (clientId ? getClientContacts(clientId) : []),
    enabled: !!clientId,
  });
}

export function useAddClientContact(clientId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateContactInput) => {
      if (!clientId) throw new Error('Client ID is required');
      return addClientContact(clientId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-contacts', clientId] });
      toast.success('Contact added');
    },
    onError: (err) => {
      toast.error('Failed to add contact', {
        description: (err as Error).message,
      });
    },
  });
}

export function useDeleteClientContact(clientId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contactId: string) => deleteClientContact(contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-contacts', clientId] });
      toast.success('Contact removed');
    },
    onError: (err) => {
      toast.error('Failed to remove contact', {
        description: (err as Error).message,
      });
    },
  });
}

export function useSeedDemoClients() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: seedDemoClients,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY });
      toast.success('Generated demo clients', {
        description: `Added ${data.count} client accounts`,
      });
    },
    onError: (err) => {
      toast.error('Failed to seed demo clients', {
        description: (err as Error).message,
      });
    },
  });
}
