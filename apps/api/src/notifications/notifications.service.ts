import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger, Optional } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { DEFAULT_NOTIFICATION_PREFERENCES, notificationPreferences, notifications, users, type NotificationPreferenceValues } from '@reka/database';
import { and, desc, eq } from 'drizzle-orm';
import { CreateNotificationDto, UpdateNotificationPreferencesDto } from './dto/notification.dto';
import { MailService } from '../mail/mail.service';
import { notificationEmail } from '../mail/mail-templates';
import { requireWorkspace, requireIssue, requireProject, requireTeam, notificationScope } from '../common/access/workspace-access';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly database: DatabaseService, @Optional() private readonly mail?: MailService) {}

  async getPreferences(userId: string) {
    await requireWorkspace(this.database.db, userId);
    const [stored] = await this.database.db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    return stored?.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
  }

  async savePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    await requireWorkspace(this.database.db, userId);
    const [current] = await this.database.db.select({ preferences: notificationPreferences.preferences })
      .from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    const preferences: NotificationPreferenceValues = {
      comments: dto.comments, mentions: dto.mentions, assignments: dto.assignments,
      issueUpdates: dto.issueUpdates, projectUpdates: dto.projectUpdates, github: dto.github, teamInvites: dto.teamInvites,
      emailNotifications: dto.emailNotifications ?? current?.preferences?.emailNotifications ?? false,
    };
    const [saved] = await this.database.db.insert(notificationPreferences).values({ userId, preferences, updatedAt: new Date() })
      .onConflictDoUpdate({ target: notificationPreferences.userId, set: { preferences, updatedAt: new Date() } }).returning();
    return saved.preferences;
  }

  async findAll(userId: string, params?: { read?: boolean; type?: string; limit?: number }) {
    const actor = await requireWorkspace(this.database.db, userId);
    const conditions = [notificationScope(this.database.db, actor)];
    if (params?.read !== undefined) conditions.push(eq(notifications.read, params.read));
    if (params?.type && params.type !== 'all') conditions.push(eq(notifications.type, params.type));

    return this.database.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(params?.limit || 100);
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const actor = await requireWorkspace(this.database.db, userId);
    const unread = await this.database.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(notificationScope(this.database.db, actor), eq(notifications.read, false)));
    return { count: unread.length };
  }

  async markAsRead(id: string, userId: string, read = true) {
    const actor = await requireWorkspace(this.database.db, userId);
    const [updated] = await this.database.db
      .update(notifications)
      .set({ read })
      .where(and(eq(notifications.id, id), notificationScope(this.database.db, actor)))
      .returning();
    if (!updated) throw new NotFoundException(`Notification with ID "${id}" not found`);
    return updated;
  }

  async markAllAsRead(userId: string) {
    const actor = await requireWorkspace(this.database.db, userId);
    const updated = await this.database.db
      .update(notifications)
      .set({ read: true })
      .where(and(notificationScope(this.database.db, actor), eq(notifications.read, false)))
      .returning({ id: notifications.id });
    return { success: true, count: updated.length };
  }

  async clearRead(userId: string) {
    const actor = await requireWorkspace(this.database.db, userId);
    const deleted = await this.database.db
      .delete(notifications)
      .where(and(notificationScope(this.database.db, actor), eq(notifications.read, true)))
      .returning({ id: notifications.id });
    return { success: true, count: deleted.length };
  }

  async delete(id: string, userId: string) {
    const actor = await requireWorkspace(this.database.db, userId);
    const deleted = await this.database.db
      .delete(notifications)
      .where(and(eq(notifications.id, id), notificationScope(this.database.db, actor)))
      .returning({ id: notifications.id });
    if (!deleted.length) throw new NotFoundException(`Notification with ID "${id}" not found`);
    return { success: true };
  }

  async createForEvent(userId: string, dto: CreateNotificationDto) {
    // Recipient eligibility is independent of the initiating HTTP session.
    try {
      const recipient = await requireWorkspace(this.database.db, userId);
      const metadata = dto.metadata ?? {};
      if (typeof metadata.issueId === 'string') await requireIssue(this.database.db, recipient, metadata.issueId);
      if (typeof metadata.projectId === 'string') await requireProject(this.database.db, recipient, metadata.projectId);
      if (typeof metadata.teamId === 'string') await requireTeam(this.database.db, recipient, metadata.teamId);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException || error instanceof BadRequestException) return null;
      throw error;
    }
    const [savedPreferences] = await this.database.db.select({ preferences: notificationPreferences.preferences })
      .from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    const prefKey: keyof NotificationPreferenceValues | undefined = dto.type === 'mention' ? 'mentions'
      : dto.type === 'comment' ? 'comments'
      : dto.type === 'assignment' ? 'assignments'
      : ['status_change', 'deadline_approaching', 'issue_blocked'].includes(dto.type) ? 'issueUpdates'
      : ['pr_review_requested', 'pr_approved', 'pr_changes_requested', 'pr_closed', 'pr_merged'].includes(dto.type) ? 'github'
      : dto.type === 'project_update' || dto.type === 'project_invite' ? 'projectUpdates'
      : dto.type === 'team_invite' ? 'teamInvites' : undefined;
    if (prefKey && !(savedPreferences?.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES)[prefKey]) return null;
    const [created] = await this.database.db
      .insert(notifications)
      .values({
        userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        link: dto.link || null,
        metadata: dto.metadata || {},
      })
      .returning();
    if (savedPreferences?.preferences?.emailNotifications) void this.emailNotification(userId, created);
    return created;
  }

  /** Opt-in email copy of an in-app notification. Best-effort: failures are logged, never raised to the caller. */
  private async emailNotification(userId: string, notification: { title: string; body: string; link: string | null }) {
    try {
      if (!this.mail?.isConfigured()) return;
      const [recipient] = await this.database.db.select({ email: users.email }).from(users).where(eq(users.id, userId));
      if (!recipient?.email) return;
      const webUrl = process.env.WEB_URL || 'http://localhost:5173';
      await this.mail.send(recipient.email, notificationEmail({
        title: notification.title, body: notification.body,
        url: notification.link ? new URL(notification.link, webUrl).toString() : undefined,
        preferencesUrl: new URL('/inbox', webUrl).toString(),
      }));
    } catch (error) { this.logger.warn(`Notification email skipped: ${(error as Error).message}`); }
  }
}
