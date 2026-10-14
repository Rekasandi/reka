import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Optional } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { comments, users, activities } from '@reka/database';
import { DatabaseService } from '../common/database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { requireAdmin, requireIssue, requireIssueWrite, requireWorkspace, userScope } from '../common/access/workspace-access';
import { IssueSubscriptionsService } from '../issue-subscriptions/issue-subscriptions.service';
import { getCommentNotificationRecipients } from './mention-recipients';

@Injectable()
export class CommentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly issueSubscriptions?: IssueSubscriptionsService,
  ) {}

  async findByIssueId(issueId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireIssue(this.database.db, actor, issueId);
    const rows = await this.database.db.select({
      id: comments.id, issueId: comments.issueId, authorId: comments.authorId,
      authorName: users.name, authorAvatar: users.avatarUrl, body: comments.body,
      createdAt: comments.createdAt, updatedAt: comments.updatedAt,
    }).from(comments).leftJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.issueId, issueId)).orderBy(desc(comments.createdAt)).limit(500);
    return rows.map(row => ({ ...row, canEdit: row.authorId === actorId || actor.role === 'owner' || actor.role === 'admin' }));
  }

  private content(body: unknown) {
    const value = typeof body === 'string' ? body.trim() : '';
    if (!value || value.length > 50000) throw new BadRequestException('Comment must contain 1–50,000 characters');
    return value;
  }

  async create(issueId: string, body: string, authorId: string) {
    const content = this.content(body);
    const actor = await requireWorkspace(this.database.db, authorId);
    const issue = await requireIssueWrite(this.database.db, actor, issueId);
    const [comment] = await this.database.db.insert(comments).values({ issueId, authorId, body: content }).returning();
    await this.database.db.insert(activities).values({ actorId: authorId, issueId, projectId: issue.projectId,
      type: 'issue.comment_created', metadata: { commentId: comment.id, bodySnippet: content.slice(0, 50) } });

    const candidates = content.includes('@') ? await this.database.db.select({
      id: users.id, name: users.name, email: users.email, githubUsername: users.githubUsername,
    }).from(users).where(userScope(this.database.db, actor)) : [];
    const { recipients: explicitRecipients, isMention } = getCommentNotificationRecipients(
      content, candidates, { assigneeId: issue.assigneeId, reporterId: issue.reporterId }, authorId,
    );
    const subscribers = await this.issueSubscriptions?.getSubscriberIds(issueId) ?? [];
    const recipients = [...new Set([...explicitRecipients, ...subscribers].filter(id => id !== authorId))];
    for (const userId of recipients) {
      try {
        const explicitMention = isMention && explicitRecipients.includes(userId);
        await this.notificationsService.createForEvent(userId, {
          type: explicitMention ? 'mention' : 'comment',
          title: explicitMention ? `Mentioned on ${issue.identifier}` : `New comment on ${issue.identifier}`,
          body: content.length > 120 ? `${content.slice(0, 117)}...` : content,
          link: '/issues',
          metadata: { issueId: issue.id, issueIdentifier: issue.identifier, issueTitle: issue.title },
        });
      } catch { /* A notification cannot undo an accepted comment. */ }
    }
    return comment;
  }

  private async authorizedComment(id: string, actorId: string) {
    const [comment] = await this.database.db.select().from(comments).where(eq(comments.id, id));
    if (!comment) throw new NotFoundException('Comment not found');
    const actor = await requireWorkspace(this.database.db, actorId);
    const issue = await requireIssueWrite(this.database.db, actor, comment.issueId);
    if (comment.authorId !== actorId) {
      if (actor.role !== 'owner' && actor.role !== 'admin') throw new ForbiddenException('Only the author or a workspace administrator may edit or delete this comment');
      // requireIssueWrite above still requires access to the team's content.
      requireAdmin(actor);
    }
    return { comment, issue, actor };
  }

  async update(id: string, body: string, actorId: string) {
    const content = this.content(body);
    const { comment, issue } = await this.authorizedComment(id, actorId);
    const [updated] = await this.database.db.update(comments).set({ body: content, updatedAt: new Date() })
      .where(eq(comments.id, comment.id)).returning();
    if (content !== comment.body) await this.database.db.insert(activities).values({
      actorId, issueId: issue.id, projectId: issue.projectId, type: 'issue.comment_updated',
      metadata: { commentId: comment.id, bodySnippet: content.slice(0, 50) },
    });
    return updated;
  }

  async delete(id: string, actorId: string) {
    const { comment, issue } = await this.authorizedComment(id, actorId);
    await this.database.db.delete(comments).where(eq(comments.id, comment.id));
    await this.database.db.insert(activities).values({ actorId, issueId: issue.id, projectId: issue.projectId,
      type: 'issue.comment_deleted', metadata: { commentId: comment.id } });
    return { success: true };
  }
}
