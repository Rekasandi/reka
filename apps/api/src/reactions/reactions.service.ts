import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, or } from 'drizzle-orm';
import { comments, reactions } from '@reka/database';
import { DatabaseService } from '../common/database/database.service';
import { requireIssue, requireIssueWrite, requireWorkspace } from '../common/access/workspace-access';
import { ToggleReactionDto } from './dto/reaction.dto';

export interface ReactionSummary { emoji: string; count: number; reacted: boolean }

@Injectable()
export class ReactionsService {
  constructor(private readonly database: DatabaseService) {}

  private summarize(rows: { emoji: string; userId: string }[], actorId: string): ReactionSummary[] {
    const byEmoji = new Map<string, { count: number; reacted: boolean }>();
    for (const row of rows) {
      const entry = byEmoji.get(row.emoji) ?? { count: 0, reacted: false };
      entry.count += 1; entry.reacted ||= row.userId === actorId;
      byEmoji.set(row.emoji, entry);
    }
    return [...byEmoji].map(([emoji, value]) => ({ emoji, ...value }));
  }

  /** Reactions on an issue and on each of its comments, visible to anyone who can read the issue. */
  async findByIssue(issueId: string, actorId: string) {
    const db = this.database.db;
    const actor = await requireWorkspace(db, actorId);
    await requireIssue(db, actor, issueId);
    const rows = await db.select({ issueId: reactions.issueId, commentId: reactions.commentId, emoji: reactions.emoji, userId: reactions.userId })
      .from(reactions).where(or(eq(reactions.issueId, issueId),
        inArray(reactions.commentId, db.select({ id: comments.id }).from(comments).where(eq(comments.issueId, issueId)))));
    const commentIds = [...new Set(rows.map((row) => row.commentId).filter((id): id is string => !!id))];
    return {
      issue: this.summarize(rows.filter((row) => row.issueId === issueId), actorId),
      comments: Object.fromEntries(commentIds.map((id) => [id, this.summarize(rows.filter((row) => row.commentId === id), actorId)])),
    };
  }

  /** Adds the reaction, or removes it when this user already left it. Needs write access to the issue. */
  async toggle(dto: ToggleReactionDto, actorId: string) {
    const db = this.database.db;
    if (!!dto.issueId === !!dto.commentId) throw new BadRequestException('React to exactly one of an issue or a comment');
    const actor = await requireWorkspace(db, actorId);
    let issueId = dto.issueId;
    if (dto.commentId) {
      const [comment] = await db.select({ issueId: comments.issueId }).from(comments).where(eq(comments.id, dto.commentId));
      if (!comment) throw new NotFoundException('Comment not found');
      issueId = comment.issueId;
    }
    await requireIssueWrite(db, actor, issueId!);
    const target = dto.issueId ? eq(reactions.issueId, dto.issueId) : eq(reactions.commentId, dto.commentId!);
    const removed = await db.delete(reactions).where(and(target, eq(reactions.userId, actorId), eq(reactions.emoji, dto.emoji))).returning({ id: reactions.id });
    if (removed.length) return { active: false };
    await db.insert(reactions).values({ issueId: dto.issueId ?? null, commentId: dto.commentId ?? null, userId: actorId, emoji: dto.emoji }).onConflictDoNothing();
    return { active: true };
  }
}
