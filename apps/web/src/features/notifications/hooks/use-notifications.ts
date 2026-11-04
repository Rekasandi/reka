import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearReadNotifications,
  deleteNotification,
  snoozeNotification,
  type GetNotificationsParams,
} from '../api/notifications.api';
import { toast } from '@reka/ui';
import { getNotificationPreferences, saveNotificationPreferences, type NotificationPreferences } from '../api/notification-preferences.api';

export const NOTIFICATIONS_QUERY_KEY = ['notifications'];
export const UNREAD_COUNT_QUERY_KEY = ['notifications', 'unread-count'];

export function useNotificationPreferences() {
  return useQuery({ queryKey: ['notification-preferences'], queryFn: getNotificationPreferences });
}

export function useSaveNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: NotificationPreferences) => saveNotificationPreferences(preferences),
    onSuccess: preferences => { queryClient.setQueryData(['notification-preferences'], preferences); toast.success('Notification preferences saved'); },
    onError: error => toast.error('Could not save preferences', { description: (error as Error).message }),
  });
}

export function useNotifications(params?: GetNotificationsParams) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, params],
    queryFn: () => getNotifications(params),
  });
}

/** One shared Server-Sent Events connection per tab, opened by the first component that shows the unread count
 * and closed when the last one unmounts (so the server-side listener is freed). Replaces polling. */
let stream: { source: EventSource; users: number } | undefined;
const LIVE_ISSUE_KEYS = new Set(['issues', 'triage', 'subtasks', 'comments', 'reactions', 'activities', 'issue-relations', 'cycles', 'projects']);

export function useUnreadCount() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!stream) {
      const source = new EventSource('/api/notifications/unread-count/stream');
      let first = true;
      source.onmessage = (event) => {
        queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, JSON.parse(event.data) as { count: number });
        // Every later message means this user's notifications changed, so refresh any open inbox list.
        if (!first) void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY, predicate: query => query.queryKey[1] !== 'unread-count' });
        first = false;
      };
      // A teammate changed issue data: refresh whatever issue views are on screen (inactive queries refetch when shown).
      source.addEventListener('issues', () => void queryClient.invalidateQueries({ predicate: query => LIVE_ISSUE_KEYS.has(String(query.queryKey[0])) }));
      stream = { source, users: 0 };
    }
    const current = stream;
    current.users += 1;
    return () => { current.users -= 1; if (!current.users) { current.source.close(); if (stream === current) stream = undefined; } };
  }, [queryClient]);
  return useQuery({
    queryKey: UNREAD_COUNT_QUERY_KEY,
    queryFn: () => getUnreadCount(),
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, read = true }: { id: string; read?: boolean }) =>
      markNotificationAsRead(id, read),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
      if (variables.read) {
        toast.info('Marked as read');
      }
    },
    onError: (err) => {
      toast.error('Failed to update status', {
        description: (err as Error).message,
      });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
      toast.success('All notifications marked as read');
    },
    onError: (err) => {
      toast.error('Failed to mark all as read', {
        description: (err as Error).message,
      });
    },
  });
}

export function useClearRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clearReadNotifications(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
      toast.success('Cleared read notifications');
    },
    onError: (err) => {
      toast.error('Failed to clear notifications', {
        description: (err as Error).message,
      });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
      toast.success('Notification removed');
    },
    onError: (err) => {
      toast.error('Failed to delete notification', {
        description: (err as Error).message,
      });
    },
  });
}

export function useSnoozeNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, until }: { id: string; until: Date | null }) => snoozeNotification(id, until),
    onSuccess: (_, { until }) => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      toast.success(until ? 'Notification snoozed' : 'Notification unsnoozed');
    },
    onError: err => toast.error('Failed to snooze notification', { description: (err as Error).message }),
  });
}
