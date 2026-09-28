import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { activities, users } from '@reka/database';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class ActivitiesService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(limit = 20) {
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
      .orderBy(desc(activities.createdAt))
      .limit(limit);
  }

  async findByIssueId(issueId: string) {
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
