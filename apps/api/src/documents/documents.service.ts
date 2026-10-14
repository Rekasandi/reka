import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { documents } from '@reka/database';
import { documentScope, projectScope, requireAdmin, requireDocument, requireProject, requireTeam, requireTeamWrite, requireWorkspace, requireWrite, visibleTeamIds } from '../common/access/workspace-access';
import { DatabaseService } from '../common/database/database.service';
import { CreateDocumentDto, UpdateDocumentDto } from './dto/documents.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly database: DatabaseService) {}
  private get db() { return this.database.db; }

  async list(actorId: string, projectId?: string, teamId?: string, includeArchived = false) {
    const actor = await requireWorkspace(this.db, actorId);
    if (projectId && teamId) throw new BadRequestException('Choose a project or team document scope');
    if (projectId) await requireProject(this.db, actor, projectId);
    if (teamId) await requireTeam(this.db, actor, teamId);
    return this.db.select().from(documents).where(and(
      documentScope(this.db, actor),
      projectId ? eq(documents.projectId, projectId) : undefined,
      teamId ? eq(documents.teamId, teamId) : undefined,
      includeArchived ? undefined : isNull(documents.archivedAt),
    )).orderBy(desc(documents.updatedAt)).limit(100);
  }

  async get(id: string, actorId: string) {
    const actor = await requireWorkspace(this.db, actorId);
    const document = await requireDocument(this.db, actor, id);
    const [visible] = await this.db.select().from(documents).where(and(eq(documents.id, document.id), documentScope(this.db, actor)));
    if (!visible) throw new NotFoundException('Document not found');
    return visible;
  }

  private async canWriteScope(actor: Awaited<ReturnType<typeof requireWorkspace>>, scope: { projectId: string | null; teamId: string | null }) {
    requireWrite(actor);
    if (scope.projectId) {
      const project = await requireProject(this.db, actor, scope.projectId);
      if (project.teamId) await requireTeamWrite(this.db, actor, project.teamId);
    } else if (scope.teamId) await requireTeamWrite(this.db, actor, scope.teamId);
    else requireAdmin(actor);
  }

  async create(actorId: string, dto: CreateDocumentDto) {
    const actor = await requireWorkspace(this.db, actorId);
    if (dto.projectId && dto.teamId) throw new BadRequestException('A document can belong to only one project or team');
    const scope = { projectId: dto.projectId ?? null, teamId: dto.teamId ?? null };
    await this.canWriteScope(actor, scope);
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('Document title is required');
    const [created] = await this.db.insert(documents).values({
      organizationId: actor.organizationId, ...scope, title, content: dto.content,
      createdBy: actor.userId, updatedBy: actor.userId,
    }).returning();
    return created;
  }

  async update(id: string, actorId: string, dto: UpdateDocumentDto) {
    const actor = await requireWorkspace(this.db, actorId);
    const document = await requireDocument(this.db, actor, id);
    await this.canWriteScope(actor, document);
    if (document.archivedAt) throw new BadRequestException('Restore the document before editing it');
    const title = dto.title === undefined ? document.title : dto.title.trim();
    if (!title) throw new BadRequestException('Document title is required');
    const [updated] = await this.db.update(documents).set({
      title, content: dto.content ?? document.content, updatedBy: actor.userId, updatedAt: new Date(),
    }).where(and(eq(documents.id, id), documentScope(this.db, actor), isNull(documents.archivedAt))).returning();
    if (!updated) throw new NotFoundException('Document not found');
    return updated;
  }

  async archive(id: string, actorId: string) {
    return this.setArchived(id, actorId, true);
  }

  async restore(id: string, actorId: string) {
    return this.setArchived(id, actorId, false);
  }

  private async setArchived(id: string, actorId: string, archive: boolean) {
    const actor = await requireWorkspace(this.db, actorId);
    const document = await requireDocument(this.db, actor, id);
    await this.canWriteScope(actor, document);
    const [updated] = await this.db.update(documents).set({
      archivedAt: archive ? new Date() : null, updatedBy: actor.userId, updatedAt: new Date(),
    }).where(and(eq(documents.id, id), documentScope(this.db, actor))).returning();
    if (!updated) throw new NotFoundException('Document not found');
    return updated;
  }
}
