import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearReadNotifications,
  deleteNotification,
  seedDemoNotifications,
  createNotification,
  type GetNotificationsParams,
} from '../api/notifications.api';
import { toast } from '@reka/ui';

export const NOTIFICATIONS_QUERY_KEY = ['notifications'];
export const UNREAD_COUNT_QUERY_KEY = ['notifications', 'unread-count'];

export function useNotifications(params?: GetNotificationsParams) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, params],
    queryFn: () => getNotifications(params),
    refetchInterval: 15000, // Light polling every 15s for live inbox updates
  });
}

export function useUnreadCount(userId?: string) {
  return useQuery({
    queryKey: [...UNREAD_COUNT_QUERY_KEY, userId],
    queryFn: () => getUnreadCount(userId),
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
    mutationFn: (userId?: string) => markAllNotificationsAsRead(userId),
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
    mutationFn: (userId?: string) => clearReadNotifications(userId),
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

export function useSeedDemoNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId?: string) => seedDemoNotifications(userId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
      toast.success('Generated demo notifications', {
        description: `Added ${data.count} triage items to your inbox`,
      });
    },
    onError: (err) => {
      toast.error('Failed to generate demo notifications', {
        description: (err as Error).message,
      });
    },
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: {
      userId?: string;
      type: string;
      title: string;
      body: string;
      link?: string;
      metadata?: Record<string, any>;
    }) => createNotification(dto),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
      toast.success('Notification sent', {
        description: created.title,
      });
    },
  });
}
