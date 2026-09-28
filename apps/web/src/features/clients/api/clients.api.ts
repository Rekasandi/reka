import type { Client, ClientContact } from '@reka/types';

export interface CreateClientInput {
  name: string;
  industry?: string;
  notes?: string;
  contact?: {
    name: string;
    email: string;
    role?: string;
    phone?: string;
  };
}

export interface CreateContactInput {
  name: string;
  email: string;
  role?: string;
  phone?: string;
}

export async function getClients(): Promise<Client[]> {
  const res = await fetch('/api/clients');
  if (!res.ok) {
    throw new Error('Failed to fetch clients');
  }
  return res.json();
}

export async function getClientById(id: string): Promise<Client> {
  const res = await fetch(`/api/clients/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch client with id ${id}`);
  }
  return res.json();
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  const res = await fetch('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error('Failed to create client');
  }
  return res.json();
}

export async function updateClient(id: string, input: Partial<CreateClientInput>): Promise<Client> {
  const res = await fetch(`/api/clients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error('Failed to update client');
  }
  return res.json();
}

export async function deleteClient(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/clients/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Failed to delete client');
  }
  return res.json();
}

export async function getClientContacts(clientId: string): Promise<ClientContact[]> {
  const res = await fetch(`/api/clients/${clientId}/contacts`);
  if (!res.ok) {
    throw new Error('Failed to fetch client contacts');
  }
  return res.json();
}

export async function addClientContact(
  clientId: string,
  input: CreateContactInput,
): Promise<ClientContact> {
  const res = await fetch(`/api/clients/${clientId}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error('Failed to add contact');
  }
  return res.json();
}

export async function deleteClientContact(contactId: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/clients/contacts/${contactId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Failed to delete contact');
  }
  return res.json();
}

export async function seedDemoClients(): Promise<{ success: boolean; count: number }> {
  const res = await fetch('/api/clients/seed-demo', {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error('Failed to seed demo clients');
  }
  return res.json();
}
