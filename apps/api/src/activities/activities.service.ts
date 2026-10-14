import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { activities, users } from '@reka/database';
import { eq, desc } from 'drizzle-orm';
import { requireWorkspace, requireIssue, activityScope } from '../common/access/workspace-access';

@Injectable()
export class ActivitiesService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(actorId: string, limit = 20) {
    const actor = await requireWorkspace(this.database.db, actorId);
    return this.database.db
      .select({
        id: activities.id,
        issueId: activities.issueId,
        projectId: activities.projectId,
        actorId: activities.actorId,
        actorName: users.name,
        type: activities.type,
        metadata: activities.metadata,
        createdAt: activities.createdAt,
      })
      .from(activities)
      .leftJoin(users, eq(activities.actorId, users.id))
      .where(activityScope(this.database.db, actor))
      .orderBy(desc(activities.createdAt))
      .limit(limit);
  }

  async findByIssueId(issueId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireIssue(this.database.db, actor, issueId);
    return this.database.db
      .select({
        id: activities.id,
        issueId: activities.issueId,
        projectId: activities.projectId,
        actorId: activities.actorId,
        actorName: users.name,
        type: activities.type,
        metadata: activities.metadata,
        createdAt: activities.createdAt,
      })
      .from(activities)
      .leftJoin(users, eq(activities.actorId, users.id))
      .where(eq(activities.issueId, issueId))
      .orderBy(desc(activities.createdAt));
  }
}
