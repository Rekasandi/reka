import type { Notification } from '@reka/types';

export interface GetNotificationsParams {
  read?: boolean;
  type?: string;
  limit?: number;
}

export async function getNotifications(params?: GetNotificationsParams): Promise<Notification[]> {
  const query = new URLSearchParams();
  if (params?.read !== undefined) query.set('read', String(params.read));
  if (params?.type && params.type !== 'all') query.set('type', params.type);
  if (params?.limit) query.set('limit', String(params.limit));

  const url = `/api/notifications${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch notifications');
  }
  return res.json();
}

export async function getUnreadCount(): Promise<{ count: number }> {
  const res = await fetch('/api/notifications/unread-count');
  if (!res.ok) {
    return { count: 0 };
  }
  return res.json();
}

export async function markNotificationAsRead(id: string, read = true): Promise<Notification> {
  const res = await fetch(`/api/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ read }),
  });
  if (!res.ok) {
    throw new Error('Failed to update notification status');
  }
  return res.json();
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean }> {
  const res = await fetch('/api/notifications/mark-all-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error('Failed to mark all as read');
  }
  return res.json();
}

export async function clearReadNotifications(): Promise<{ success: boolean }> {
  const res = await fetch('/api/notifications/clear-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error('Failed to clear read notifications');
  }
  return res.json();
}

export async function deleteNotification(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/notifications/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Failed to delete notification');
  }
  return res.json();
}
