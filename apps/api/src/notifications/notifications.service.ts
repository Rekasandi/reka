import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { notifications, users } from '@reka/database';
import { eq, desc, and } from 'drizzle-orm';
import { CreateNotificationDto, UpdateNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  private async getResolvedUserId(userId?: string): Promise<string | null> {
    if (userId) return userId;
    const [user] = await this.database.db.select().from(users).limit(1);
    return user ? user.id : null;
  }

  async findAll(params?: { userId?: string; read?: boolean; type?: string; limit?: number }) {
    const conditions = [];

    const resolvedUserId = await this.getResolvedUserId(params?.userId);
    if (resolvedUserId) {
      conditions.push(eq(notifications.userId, resolvedUserId));
    }

    if (params?.read !== undefined) {
      conditions.push(eq(notifications.read, params.read));
    }

    if (params?.type && params.type !== 'all') {
      conditions.push(eq(notifications.type, params.type));
    }

    let results = await this.database.db
      .select()
      .from(notifications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(notifications.createdAt))
      .limit(params?.limit || 100);

    // If completely empty and we have a user, auto-seed demo notifications once
    if (results.length === 0 && resolvedUserId && params?.type === undefined && params?.read === undefined) {
      await this.seedDemo(resolvedUserId);
      results = await this.database.db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, resolvedUserId))
        .orderBy(desc(notifications.createdAt))
        .limit(params?.limit || 100);
    }

    return results;
  }

  async findByUserId(userId: string) {
    return this.findAll({ userId });
  }

  async getUnreadCount(userId?: string): Promise<{ count: number }> {
    const resolvedUserId = await this.getResolvedUserId(userId);
    if (!resolvedUserId) return { count: 0 };

    const unread = await this.database.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, resolvedUserId), eq(notifications.read, false)));

    return { count: unread.length };
  }

  async findById(id: string) {
    const [notification] = await this.database.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id));

    if (!notification) {
      throw new NotFoundException(`Notification with ID "${id}" not found`);
    }

    return notification;
  }

  async markAsRead(id: string, read = true) {
    const [updated] = await this.database.db
      .update(notifications)
      .set({ read })
      .where(eq(notifications.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Notification with ID "${id}" not found`);
    }

    return updated;
  }

  async markAllAsRead(userId?: string) {
    const resolvedUserId = await this.getResolvedUserId(userId);
    if (!resolvedUserId) return { count: 0 };

    await this.database.db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, resolvedUserId), eq(notifications.read, false)));

    return { success: true };
  }

  async clearRead(userId?: string) {
    const resolvedUserId = await this.getResolvedUserId(userId);
    if (!resolvedUserId) return { success: true };

    await this.database.db
      .delete(notifications)
      .where(and(eq(notifications.userId, resolvedUserId), eq(notifications.read, true)));

    return { success: true };
  }

  async delete(id: string) {
    await this.database.db.delete(notifications).where(eq(notifications.id, id));
    return { success: true };
  }

  async create(dto: CreateNotificationDto) {
    let targetUserId = dto.userId;
    if (!targetUserId) {
      targetUserId = (await this.getResolvedUserId()) || undefined;
    }

    if (!targetUserId) {
      throw new NotFoundException('Cannot create notification: no user found');
    }

    const [created] = await this.database.db
      .insert(notifications)
      .values({
        userId: targetUserId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        link: dto.link || null,
        metadata: dto.metadata || {},
      })
      .returning();

    return created;
  }

  async seedDemo(userId?: string) {
    const resolvedUserId = await this.getResolvedUserId(userId);
    if (!resolvedUserId) return { success: false, message: 'No user found to seed notifications' };

    const demoItems = [
      {
        userId: resolvedUserId,
        type: 'pr_merged',
        title: 'PR #142 Merged: Add optimistic UI updates for Kanban board',
        body: 'Gustam merged pull request #142 into main branch. Linked issue RS-42 status has been transitioned to Done automatically.',
        link: '/issues',
        metadata: {
          issueIdentifier: 'RS-42',
          prNumber: 142,
          prTitle: 'Add optimistic UI updates for Kanban board',
          authorName: 'Gustam',
          repo: 'rekasandi/reka',
          state: 'merged',
        },
        read: false,
      },
      {
        userId: resolvedUserId,
        type: 'mention',
        title: 'Sarah Jenkins mentioned you on RS-58',
        body: '@gustam Could you check the proposed notification preferences schema in the planning doc? We want to support email/in-app toggles.',
        link: '/issues',
        metadata: {
          issueIdentifier: 'RS-58',
          authorName: 'Sarah Jenkins',
          commentSnippet: '@gustam Could you check the proposed notification preferences schema?',
        },
        read: false,
      },
      {
        userId: resolvedUserId,
        type: 'assignment',
        title: 'Assigned to RS-64: High-velocity triage inbox',
        body: 'You were assigned to RS-64: Build Linear-grade triage inbox with keyboard shortcuts by David Chen.',
        link: '/issues',
        metadata: {
          issueIdentifier: 'RS-64',
          priority: 'urgent',
          assignedBy: 'David Chen',
          status: 'in_progress',
        },
        read: false,
      },
      {
        userId: resolvedUserId,
        type: 'pr_review_requested',
        title: 'Alex Morgan requested your review on PR #149',
        body: 'Implement WebAuthn passkey registration flow and browser biometric credentials support.',
        link: '/issues',
        metadata: {
          issueIdentifier: 'RS-33',
          prNumber: 149,
          prTitle: 'WebAuthn passkey registration flow',
          requester: 'Alex Morgan',
          repo: 'rekasandi/reka',
        },
        read: false,
      },
      {
        userId: resolvedUserId,
        type: 'status_change',
        title: 'RS-49 moved to In Review',
        body: 'Optimize PostgreSQL egress on cycle queries was transitioned from In Progress to In Review by Gustam.',
        link: '/issues',
        metadata: {
          issueIdentifier: 'RS-49',
          fromStatus: 'in_progress',
          toStatus: 'in_review',
          title: 'Optimize PostgreSQL egress on cycle queries',
        },
        read: true,
      },
      {
        userId: resolvedUserId,
        type: 'deadline_approaching',
        title: 'Cycle 12 ends in 2 days',
        body: 'Sprint 12 cycle has 4 remaining open issues scheduled before Friday 18:00 UTC.',
        link: '/cycles',
        metadata: {
          cycleName: 'Sprint 12',
          daysRemaining: 2,
          openIssuesCount: 4,
        },
        read: true,
      },
    ];

    for (const item of demoItems) {
      await this.database.db.insert(notifications).values(item);
    }

    return { success: true, count: demoItems.length };
  }
}
