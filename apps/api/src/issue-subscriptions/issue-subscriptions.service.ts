import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { issueSubscriptions } from '@reka/database';
import { DatabaseService } from '../common/database/database.service';
import { requireIssue, requireWorkspace } from '../common/access/workspace-access';

@Injectable()
export class IssueSubscriptionsService {
  constructor(private readonly database: DatabaseService) {}

  async getState(issueId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireIssue(this.database.db, actor, issueId);
    const [subscription] = await this.database.db.select({ createdAt: issueSubscriptions.createdAt })
      .from(issueSubscriptions).where(and(eq(issueSubscriptions.issueId, issueId), eq(issueSubscriptions.userId, actorId)));
    return { subscribed: Boolean(subscription), createdAt: subscription?.createdAt ?? null };
  }

  async subscribe(issueId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireIssue(this.database.db, actor, issueId);
    await this.database.db.insert(issueSubscriptions).values({ issueId, userId: actorId }).onConflictDoNothing();
    return this.getState(issueId, actorId);
  }

  async unsubscribe(issueId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireIssue(this.database.db, actor, issueId);
    await this.database.db.delete(issueSubscriptions).where(and(eq(issueSubscriptions.issueId, issueId), eq(issueSubscriptions.userId, actorId)));
    return { subscribed: false, createdAt: null };
  }

  async getSubscriberIds(issueId: string) {
    return (await this.database.db.select({ userId: issueSubscriptions.userId }).from(issueSubscriptions)
      .where(eq(issueSubscriptions.issueId, issueId))).map(row => row.userId);
  }
}
