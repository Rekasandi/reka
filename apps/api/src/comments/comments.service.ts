import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { comments, users, issues, activities } from '@reka/database';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class CommentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}


  async findByIssueId(issueId: string) {
    return this.database.db
      .select({
        id: comments.id,
        issueId: comments.issueId,
        authorId: comments.authorId,
        authorName: users.name,
        authorAvatar: users.avatarUrl,
        body: comments.body,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.issueId, issueId))
      .orderBy(desc(comments.createdAt));
  }

  async create(issueId: string, body: string, authorId?: string) {
    if (!body || !body.trim()) {
      throw new Error('Comment body cannot be empty');
    }

    // Resolve author
    let resolvedAuthorId = authorId;
    if (!resolvedAuthorId) {
      const userList = await this.database.db.select().from(users).limit(1);
      if (userList.length) resolvedAuthorId = userList[0].id;
    }

    if (!resolvedAuthorId) {
      throw new NotFoundException('No user found to author comment');
    }

    const [comment] = await this.database.db
      .insert(comments)
      .values({
        issueId,
        authorId: resolvedAuthorId,
        body: body.trim(),
      })
      .returning();

    // Log activity
    await this.database.db.insert(activities).values({
      actorId: resolvedAuthorId,
      issueId,
      type: 'issue.comment_created',
      metadata: { bodySnippet: body.slice(0, 50) },
    });

    // Notify assignee / author if different
    try {
      const [issue] = await this.database.db.select().from(issues).where(eq(issues.id, issueId));
      if (issue) {
        const notifyTarget = issue.assigneeId && issue.assigneeId !== resolvedAuthorId
          ? issue.assigneeId
          : (issue.reporterId && issue.reporterId !== resolvedAuthorId ? issue.reporterId : null);

        if (notifyTarget) {
          const isMention = body.includes('@');
          await this.notificationsService.create({
            userId: notifyTarget,
            type: isMention ? 'mention' : 'comment',
            title: isMention ? `Mentioned on ${issue.identifier}` : `New comment on ${issue.identifier}`,
            body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
            link: `/issues`,
            metadata: {
              issueId: issue.id,
              issueIdentifier: issue.identifier,
              issueTitle: issue.title,
            },
          });
        }
      }
    } catch {
      // Non-fatal notification failure
    }

    return comment;
  }
}
