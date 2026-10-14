import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { automationRules, projects } from '@reka/database';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { projectScope, visibleTeamIds, type WorkspaceActor } from '../common/access/workspace-access';

@Injectable()
export class AutomationsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(actor: WorkspaceActor) {
    const db = this.database.db;
    return db.select().from(automationRules).where(and(
      eq(automationRules.organizationId, actor.organizationId),
      and(
        or(isNull(automationRules.teamId), inArray(automationRules.teamId, visibleTeamIds(db, actor))),
        or(isNull(automationRules.projectId), inArray(automationRules.projectId,
          db.select({ id: projects.id }).from(projects).where(projectScope(db, actor)))),
      ),
    ));
  }
}
