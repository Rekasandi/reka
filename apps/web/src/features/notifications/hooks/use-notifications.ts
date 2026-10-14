import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearReadNotifications,
  deleteNotification,
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
    refetchInterval: 15000, // Light polling every 15s for live inbox updates
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: UNREAD_COUNT_QUERY_KEY,
    queryFn: () => getUnreadCount(),
    refetchInterval: 15000,
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
