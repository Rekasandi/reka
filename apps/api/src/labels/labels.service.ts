import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { and, eq } from 'drizzle-orm';
import { labels } from '@reka/database';
import { requireProject, requireResourceId, requireTeamManager, requireTeamWrite, requireWorkspace, labelScope } from '../common/access/workspace-access';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';

@Injectable()
export class LabelsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    return this.database.db.select().from(labels).where(labelScope(this.database.db, actor));
  }

  async update(actorId: string, id: string, dto: UpdateLabelDto) {
    requireResourceId(id);
    if (!Object.keys(dto).length) throw new BadRequestException('At least one label field is required');
    const actor = await requireWorkspace(this.database.db, actorId);
    const [label] = await this.database.db.select().from(labels).where(and(eq(labels.id, id), labelScope(this.database.db, actor))).limit(1);
    if (!label?.teamId) throw new NotFoundException('Label not found');
    await requireTeamManager(this.database.db, actor, label.teamId);
    const [updated] = await this.database.db.update(labels).set(dto).where(and(eq(labels.id, id), labelScope(this.database.db, actor))).returning();
    if (!updated) throw new NotFoundException('Label not found');
    return updated;
  }

  async remove(actorId: string, id: string) {
    requireResourceId(id);
    const actor = await requireWorkspace(this.database.db, actorId);
    const [label] = await this.database.db.select().from(labels).where(and(eq(labels.id, id), labelScope(this.database.db, actor))).limit(1);
    if (!label?.teamId) throw new NotFoundException('Label not found');
    await requireTeamManager(this.database.db, actor, label.teamId);
    const [deleted] = await this.database.db.delete(labels).where(and(eq(labels.id, id), labelScope(this.database.db, actor))).returning({ id: labels.id });
    if (!deleted) throw new NotFoundException('Label not found');
    return { id: deleted.id, success: true };
  }

  async create(actorId: string, dto: CreateLabelDto) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const team = await requireTeamWrite(this.database.db, actor, dto.teamId);
    if (dto.projectId) {
      const project = await requireProject(this.database.db, actor, dto.projectId);
      if (project.teamId !== team.id) throw new BadRequestException('Label project must belong to the selected team');
    }
    const [label] = await this.database.db.insert(labels).values({
      organizationId: actor.organizationId, teamId: team.id, projectId: dto.projectId ?? null,
      name: dto.name.trim(), color: dto.color,
    }).returning();
    return label;
  }
}
