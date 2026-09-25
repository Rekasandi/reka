import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { cycles, teams, issues } from '@reka/database';
import { eq, desc, and, ne } from 'drizzle-orm';
import { CreateCycleDto, UpdateCycleDto, CompleteCycleDto } from './dto/cycle.dto';

@Injectable()
export class CyclesService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    const cycleList = await this.database.db
      .select()
      .from(cycles)
      .orderBy(desc(cycles.number));

    const allIssues = await this.database.db.select().from(issues);
    const now = new Date();

    return cycleList.map((c) => {
      const cIssues = allIssues.filter((i) => i.cycleId === c.id);
      const totalIssues = cIssues.length;
      const completedIssues = cIssues.filter((i) => i.status === 'done').length;
      const progress = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

      let status: 'active' | 'upcoming' | 'completed' = 'upcoming';
      if (c.isCompleted || now > new Date(c.endDate)) {
        status = 'completed';
      } else if (now >= new Date(c.startDate) && now <= new Date(c.endDate)) {
        status = 'active';
      }

      return {
        ...c,
        status,
        totalIssues,
        completedIssues,
        progress,
        issues: cIssues,
      };
    });
  }

  async findById(id: string) {
    const result = await this.database.db.select().from(cycles).where(eq(cycles.id, id));
    if (!result.length) {
      throw new NotFoundException(`Cycle with ID ${id} not found`);
    }

    const c = result[0];
    const cIssues = await this.database.db.select().from(issues).where(eq(issues.cycleId, c.id));
    const totalIssues = cIssues.length;
    const completedIssues = cIssues.filter((i) => i.status === 'done').length;
    const progress = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;
    const now = new Date();

    let status: 'active' | 'upcoming' | 'completed' = 'upcoming';
    if (c.isCompleted || now > new Date(c.endDate)) {
      status = 'completed';
    } else if (now >= new Date(c.startDate) && now <= new Date(c.endDate)) {
      status = 'active';
    }

    return {
      ...c,
      status,
      totalIssues,
      completedIssues,
      progress,
      issues: cIssues,
    };
  }

  async findByTeamId(teamId: string) {
    return this.database.db
      .select()
      .from(cycles)
      .where(eq(cycles.teamId, teamId))
      .orderBy(desc(cycles.number));
  }

  async create(dto: CreateCycleDto) {
    let teamId = dto.teamId;
    if (!teamId) {
      const [team] = await this.database.db.select().from(teams).limit(1);
      if (!team) throw new NotFoundException('No active team found');
      teamId = team.id;
    }

    const [latest] = await this.database.db
      .select({ number: cycles.number })
      .from(cycles)
      .where(eq(cycles.teamId, teamId))
      .orderBy(desc(cycles.number))
      .limit(1);

    const nextNumber = (latest?.number ?? 0) + 1;
    const name = dto.name?.trim() || `Cycle ${nextNumber}`;

    const [created] = await this.database.db
      .insert(cycles)
      .values({
        teamId,
        number: nextNumber,
        name,
        description: dto.description || null,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isCompleted: false,
      })
      .returning();

    return created;
  }

  async update(id: string, dto: UpdateCycleDto) {
    await this.findById(id);

    const [updated] = await this.database.db
      .update(cycles)
      .set({
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(cycles.id, id))
      .returning();

    return updated;
  }

  async completeCycle(id: string, dto: CompleteCycleDto) {
    const cycle = await this.findById(id);

    // 1. Mark cycle as completed
    await this.database.db
      .update(cycles)
      .set({
        isCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(cycles.id, id));

    // 2. Rollover incomplete issues
    const incompleteIssues = await this.database.db
      .select()
      .from(issues)
      .where(and(eq(issues.cycleId, id), ne(issues.status, 'done'), ne(issues.status, 'canceled')));

    if (incompleteIssues.length > 0) {
      if (dto.incompleteIssuesAction === 'backlog') {
        for (const item of incompleteIssues) {
          await this.database.db
            .update(issues)
            .set({ cycleId: null, status: 'backlog', updatedAt: new Date() })
            .where(eq(issues.id, item.id));
        }
      } else if (dto.incompleteIssuesAction === 'next_cycle') {
        let targetCycleId = dto.nextCycleId;
        if (!targetCycleId) {
          // Find next upcoming cycle
          const upcoming = await this.database.db
            .select()
            .from(cycles)
            .where(and(eq(cycles.teamId, cycle.teamId), eq(cycles.isCompleted, false), ne(cycles.id, id)))
            .orderBy(cycles.number)
            .limit(1);

          if (upcoming.length) {
            targetCycleId = upcoming[0].id;
          }
        }

        for (const item of incompleteIssues) {
          await this.database.db
            .update(issues)
            .set({ cycleId: targetCycleId || null, updatedAt: new Date() })
            .where(eq(issues.id, item.id));
        }
      }
    }

    return {
      success: true,
      rolledOverCount: incompleteIssues.length,
      action: dto.incompleteIssuesAction,
    };
  }

  async delete(id: string) {
    await this.findById(id);
    await this.database.db.delete(cycles).where(eq(cycles.id, id));
    return { success: true };
  }
}
