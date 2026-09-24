import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { issues, teams, users, activities } from '@reka/database';
import { eq, desc } from 'drizzle-orm';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';

@Injectable()
export class IssuesService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(status?: string) {
    if (status) {
      return this.database.db
        .select()
        .from(issues)
        .where(eq(issues.status, status))
        .orderBy(desc(issues.createdAt));
    }

    return this.database.db
      .select()
      .from(issues)
      .orderBy(desc(issues.createdAt));
  }

  async findById(id: string) {
    const result = await this.database.db.select().from(issues).where(eq(issues.id, id));
    if (!result.length) {
      throw new NotFoundException(`Issue with ID ${id} not found`);
    }
    return result[0];
  }

  async findByIdentifier(identifier: string) {
    const result = await this.database.db
      .select()
      .from(issues)
      .where(eq(issues.identifier, identifier.toUpperCase()));
    if (!result.length) {
      throw new NotFoundException(`Issue ${identifier} not found`);
    }
    return result[0];
  }

  async create(dto: CreateIssueDto) {
    // 1. Resolve Team
    let teamId = dto.teamId;
    let teamKey = 'RS';

    if (teamId) {
      const teamList = await this.database.db.select().from(teams).where(eq(teams.id, teamId));
      if (teamList.length) teamKey = teamList[0].key;
    } else {
      const teamList = await this.database.db.select().from(teams).limit(1);
      if (teamList.length) {
        teamId = teamList[0].id;
        teamKey = teamList[0].key;
      }
    }

    if (!teamId) {
      throw new NotFoundException('No active team found to assign issue to');
    }

    // 2. Resolve Reporter
    const userList = await this.database.db.select().from(users).limit(1);
    const reporterId = userList.length ? userList[0].id : undefined;

    if (!reporterId) {
      throw new NotFoundException('No user found to set as reporter');
    }

    // 3. Increment Identifier
    const [latest] = await this.database.db
      .select({ number: issues.number })
      .from(issues)
      .where(eq(issues.teamId, teamId))
      .orderBy(desc(issues.number))
      .limit(1);

    const nextNumber = (latest?.number ?? 0) + 1;
    const identifier = `${teamKey}-${nextNumber}`;

    // 4. Insert Issue
    const [created] = await this.database.db
      .insert(issues)
      .values({
        identifier,
        number: nextNumber,
        title: dto.title,
        description: dto.description || null,
        status: dto.status || 'todo',
        priority: dto.priority || 'no_priority',
        type: dto.type || 'task',
        teamId,
        projectId: dto.projectId || null,
        assigneeId: dto.assigneeId || reporterId,
        reporterId,
      })
      .returning();

    // 5. Record activity
    await this.database.db.insert(activities).values({
      actorId: reporterId,
      issueId: created.id,
      projectId: created.projectId,
      type: 'issue.created',
      metadata: { identifier, title: created.title },
    });

    return created;
  }

  async update(id: string, dto: UpdateIssueDto) {
    const existing = await this.findById(id);

    const [updated] = await this.database.db
      .update(issues)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, id))
      .returning();

    // Record activity if status changed
    if (dto.status && dto.status !== existing.status) {
      await this.database.db.insert(activities).values({
        issueId: id,
        projectId: updated.projectId,
        type: 'issue.status_changed',
        metadata: {
          from: existing.status,
          to: dto.status,
          identifier: updated.identifier,
        },
      });
    }

    return updated;
  }

  async delete(id: string) {
    await this.findById(id);
    await this.database.db.delete(issues).where(eq(issues.id, id));
    return { success: true, id };
  }
}
