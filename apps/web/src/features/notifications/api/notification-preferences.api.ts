export interface NotificationPreferences {
  comments: boolean; mentions: boolean; assignments: boolean; issueUpdates: boolean;
  projectUpdates: boolean; github: boolean; teamInvites: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  comments: true, mentions: true, assignments: true, issueUpdates: true,
  projectUpdates: true, github: true, teamInvites: true,
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await fetch('/api/notifications/preferences');
  if (!response.ok) throw new Error('Failed to load notification preferences');
  return response.json();
}
export async function saveNotificationPreferences(preferences: NotificationPreferences): Promise<NotificationPreferences> {
  const response = await fetch('/api/notifications/preferences', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message || 'Failed to save notification preferences');
  }
  return response.json();
}
