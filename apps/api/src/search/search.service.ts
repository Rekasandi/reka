import { BadRequestException, Injectable } from '@nestjs/common';
import { and, desc, ilike, isNull, or } from 'drizzle-orm';
import { documents, issues, projects } from '@reka/database';
import { documentScope, issueScope, projectScope, requireWorkspace } from '../common/access/workspace-access';
import { DatabaseService } from '../common/database/database.service';

@Injectable()
export class SearchService {
  constructor(private readonly database: DatabaseService) {}

  async globalSearch(query: string, actorId: string, rawLimit = '10', rawOffset = '0') {
    const actor = await requireWorkspace(this.database.db, actorId);
    if (typeof query !== 'string' || query.length > 100) throw new BadRequestException('Search query must be at most 100 characters');
    const limit = Number(rawLimit), offset = Number(rawOffset);
    if (!Number.isInteger(limit) || limit < 1 || limit > 25 || !Number.isInteger(offset) || offset < 0 || offset > 1000) {
      throw new BadRequestException('Invalid search pagination');
    }
    const term = query.trim().replace(/[\\%_]/g, '\\$&');
    if (term.length < 2) return { issues: [], projects: [], documents: [], hasMore: false };
    const pattern = `%${term}%`;
    const [issueResults, projectResults, documentResults] = await Promise.all([
      this.database.db.select({
        id: issues.id, identifier: issues.identifier, title: issues.title, status: issues.status,
        teamId: issues.teamId, projectId: issues.projectId,
      }).from(issues).where(and(issueScope(this.database.db, actor), isNull(issues.archivedAt),
        or(ilike(issues.title, pattern), ilike(issues.identifier, pattern)))).orderBy(desc(issues.updatedAt)).limit(limit + 1).offset(offset),
      this.database.db.select({ id: projects.id, name: projects.name, status: projects.status, teamId: projects.teamId })
        .from(projects).where(and(projectScope(this.database.db, actor), ilike(projects.name, pattern)))
        .orderBy(desc(projects.updatedAt)).limit(limit + 1).offset(offset),
      this.database.db.select({ id: documents.id, title: documents.title, projectId: documents.projectId, teamId: documents.teamId, updatedAt: documents.updatedAt })
        .from(documents).where(and(documentScope(this.database.db, actor), isNull(documents.archivedAt), or(ilike(documents.title, pattern), ilike(documents.content, pattern))))
        .orderBy(desc(documents.updatedAt)).limit(limit + 1).offset(offset),
    ]);
    return {
      issues: issueResults.slice(0, limit), projects: projectResults.slice(0, limit), documents: documentResults.slice(0, limit),
      hasMore: issueResults.length > limit || projectResults.length > limit || documentResults.length > limit,
    };
  }
}
