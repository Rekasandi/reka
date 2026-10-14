import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';
import { archiveDocument, createDocument, getDocument, getDocuments, restoreDocument, updateDocument, type ProjectDocument } from '../api/documents.api';

export const useDocuments = (scope: { projectId?: string; teamId?: string } = {}, includeArchived = false) =>
  useQuery({ queryKey: ['documents', scope, includeArchived], queryFn: () => getDocuments(scope, includeArchived) });
export const useDocument = (id?: string) => useQuery({ queryKey: ['document', id], queryFn: () => getDocument(id!), enabled: !!id });
const invalidateDocuments = (client: ReturnType<typeof useQueryClient>, document?: ProjectDocument) => {
  client.invalidateQueries({ queryKey: ['documents'] });
  if (document?.id) client.invalidateQueries({ queryKey: ['document', document.id] });
  client.invalidateQueries({ queryKey: ['favorites'] });
};
export function useCreateDocument() {
  const client = useQueryClient();
  return useMutation({ mutationFn: createDocument, onSuccess: document => { invalidateDocuments(client, document); toast.success('Document created'); }, onError: error => toast.error('Could not create document', { description: error.message }) });
}
export function useUpdateDocument() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: { title?: string; content?: string } }) => updateDocument(id, input), onSuccess: document => { invalidateDocuments(client, document); toast.success('Document saved'); }, onError: error => toast.error('Could not save document', { description: error.message }) });
}
export function useArchiveDocument() {
  const client = useQueryClient();
  return useMutation({ mutationFn: archiveDocument, onSuccess: document => { invalidateDocuments(client, document); toast.success('Document archived'); }, onError: error => toast.error('Could not archive document', { description: error.message }) });
}
export function useRestoreDocument() {
  const client = useQueryClient();
  return useMutation({ mutationFn: restoreDocument, onSuccess: document => { invalidateDocuments(client, document); toast.success('Document restored'); }, onError: error => toast.error('Could not restore document', { description: error.message }) });
}
