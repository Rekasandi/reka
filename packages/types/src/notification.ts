import type { NotificationType } from './common';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  read: boolean;
  metadata?: Record<string, any>;
  createdAt: Date | string;
}

