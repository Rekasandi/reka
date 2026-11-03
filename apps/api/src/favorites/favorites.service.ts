import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { documents, issues, projects, userFavorites } from '@reka/database';
import {
  documentScope, projectScope, requireDocument, requireIssue, requireProject, requireResourceId,
  requireWorkspace, requireWrite, visibleTeamIds,
} from '../common/access/workspace-access';
import { DatabaseService } from '../common/database/database.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly database: DatabaseService) {}
  private get db() { return this.database.db; }

  async addFavorite(actorId: string, resourceType: 'issue' | 'project' | 'document', resourceId: string) {
    const actor = await requireWorkspace(this.db, actorId);
    requireWrite(actor);
    requireResourceId(resourceId);
    if (resourceType === 'issue') await requireIssue(this.db, actor, resourceId);
    else if (resourceType === 'project') await requireProject(this.db, actor, resourceId);
    else await requireDocument(this.db, actor, resourceId);
    await this.db.insert(userFavorites).values({ organizationId: actor.organizationId, userId: actor.userId, resourceType, resourceId }).onConflictDoNothing();
    return { success: true };
  }

  async removeFavorite(actorId: string, resourceType: string, resourceId: string) {
    const actor = await requireWorkspace(this.db, actorId);
    requireWrite(actor);
    if (!['issue', 'project', 'document'].includes(resourceType)) throw new BadRequestException('Invalid favorite type');
    requireResourceId(resourceId);
    await this.db.delete(userFavorites).where(and(
      eq(userFavorites.organizationId, actor.organizationId), eq(userFavorites.userId, actor.userId),
      eq(userFavorites.resourceType, resourceType), eq(userFavorites.resourceId, resourceId),
    ));
    return { success: true };
  }

  async listFavorites(actorId: string) {
    const actor = await requireWorkspace(this.db, actorId);
    const rows = await this.db.select().from(userFavorites).where(and(
      eq(userFavorites.organizationId, actor.organizationId), eq(userFavorites.userId, actor.userId),
    )).orderBy(desc(userFavorites.createdAt)).limit(100);
    const result: Array<{ resourceType: string; resourceId: string; name: string; href: string }> = [];
    for (const favorite of rows) {
      try {
        if (favorite.resourceType === 'issue') {
          const [item] = await this.db.select({ id: issues.id, title: issues.title, identifier: issues.identifier }).from(issues).where(and(eq(issues.id, favorite.resourceId), inArray(issues.teamId, visibleTeamIds(this.db, actor))));
          if (item) result.push({ resourceType: 'issue', resourceId: item.id, name: `${item.identifier} · ${item.title}`, href: `/issues?issueId=${item.id}` });
        } else if (favorite.resourceType === 'project') {
          const [item] = await this.db.select({ id: projects.id, name: projects.name }).from(projects).where(and(eq(projects.id, favorite.resourceId), projectScope(this.db, actor)));
          if (item) result.push({ resourceType: 'project', resourceId: item.id, name: item.name, href: `/projects/${item.id}` });
        } else if (favorite.resourceType === 'document') {
          const [item] = await this.db.select({ id: documents.id, title: documents.title }).from(documents).where(and(
            eq(documents.id, favorite.resourceId), documentScope(this.db, actor), isNull(documents.archivedAt),
          ));
          if (item) result.push({ resourceType: 'document', resourceId: item.id, name: item.title, href: `/documents/${item.id}` });
        }
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
        // Revoked or deleted resource: omit both its identifier and title.
      }
    }
    return result;
  }
}
