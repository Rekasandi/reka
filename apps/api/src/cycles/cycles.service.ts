import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { sql, eq, desc, and, inArray, isNull } from 'drizzle-orm';
import { cycles, cycleSnapshots, issues, teamCycleSettings } from '@reka/database';
import { DatabaseService } from '../common/database/database.service';
import { loadIssueStatusCategories, getIssueStatusCategory } from '../issues/issue-status';
import { requireWorkspace, requireTeam, requireTeamManager, requireCycle, cycleScope, issueScope } from '../common/access/workspace-access';
import { CreateCycleDto, UpdateCycleDto, CompleteCycleDto, TeamCycleSettingsDto } from './dto/cycle.dto';

const ACTIVITY_CATEGORIES = new Set(['unstarted', 'started']);
const INCLUDED_CATEGORIES = new Set(['unstarted', 'started', 'completed']);

@Injectable()
export class CyclesService {
  constructor(private readonly database: DatabaseService) {}

  private metrics(cycle: typeof cycles.$inferSelect, cycleIssues: typeof issues.$inferSelect[], categories: Map<string, string>) {
    const included = cycleIssues.filter(issue => INCLUDED_CATEGORIES.has(getIssueStatusCategory(issue, categories)));
    const completed = included.filter(issue => getIssueStatusCategory(issue, categories) === 'completed');
    const remaining = included.filter(issue => ACTIVITY_CATEGORIES.has(getIssueStatusCategory(issue, categories)));
    const plannedEstimate = included.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0);
    const completedEstimate = completed.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0);
    const remainingEstimate = remaining.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0);
    const missingEstimateCount = included.filter(issue => issue.estimate === null).length;
    const now = new Date();
    const status = cycle.isCompleted || now > new Date(cycle.endDate) ? 'completed'
      : now >= new Date(cycle.startDate) ? 'active' : 'upcoming';
    return {
      ...cycle, status, issues: cycleIssues,
      totalIssues: included.length, completedIssues: completed.length, remainingIssues: remaining.length,
      progress: included.length ? Math.round(completed.length / included.length * 100) : 0,
      plannedEstimate, completedEstimate, remainingEstimate, missingEstimateCount,
      remainingCapacity: cycle.capacity === null ? null : cycle.capacity - plannedEstimate,
    };
  }

  async findAll(actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const [cycleList, allIssues] = await Promise.all([
      this.database.db.select().from(cycles).where(cycleScope(this.database.db, actor)).orderBy(desc(cycles.number)).limit(500),
      this.database.db.select().from(issues).where(and(issueScope(this.database.db, actor), isNull(issues.archivedAt))),
    ]);
    const categories = await loadIssueStatusCategories(this.database.db, [...new Set(allIssues.map(issue => issue.teamId))]);
    return cycleList.map(cycle => this.metrics(cycle, allIssues.filter(issue => issue.cycleId === cycle.id), categories));
  }

  async findById(id: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const cycle = await requireCycle(this.database.db, actor, id);
    const cycleIssues = await this.database.db.select().from(issues).where(and(
      eq(issues.cycleId, cycle.id), issueScope(this.database.db, actor), isNull(issues.archivedAt),
    ));
    const categories = await loadIssueStatusCategories(this.database.db, [...new Set(cycleIssues.map(issue => issue.teamId))]);
    return this.metrics(cycle, cycleIssues, categories);
  }

  async findByTeamId(teamId: string, actorId: string) {
    await requireTeam(this.database.db, await requireWorkspace(this.database.db, actorId), teamId);
    return this.database.db.select().from(cycles).where(eq(cycles.teamId, teamId)).orderBy(desc(cycles.number)).limit(500);
  }

  private validateCycleDates(startDate: Date, endDate: Date) {
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate >= endDate) {
      throw new BadRequestException('Cycle end date must be after its start date');
    }
  }

  private rethrowCycleConflict(error: unknown): never {
    const databaseError = error as { code?: string; constraint?: string };
    if (databaseError?.code === '23P01' || databaseError?.constraint === 'cycles_no_open_overlap') {
      throw new BadRequestException('Cycle dates overlap another open cycle in this team');
    }
    throw error;
  }

  async create(dto: CreateCycleDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireTeamManager(this.database.db, actor, dto.teamId);
    const startDate = new Date(dto.startDate); const endDate = new Date(dto.endDate);
    this.validateCycleDates(startDate, endDate);
    const [latest] = await this.database.db.select({ number: cycles.number }).from(cycles)
      .where(eq(cycles.teamId, dto.teamId)).orderBy(desc(cycles.number)).limit(1);
    const number = (latest?.number ?? 0) + 1;
    try {
      const [created] = await this.database.db.insert(cycles).values({
        teamId: dto.teamId, number, name: dto.name?.trim() || `Cycle ${number}`, description: dto.description?.trim() || null,
        startDate, endDate, capacity: dto.capacity ?? null, isCompleted: false,
      }).returning();
      return created;
    } catch (error) { this.rethrowCycleConflict(error); }
  }

  async update(id: string, dto: UpdateCycleDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const cycle = await requireCycle(this.database.db, actor, id);
    await requireTeamManager(this.database.db, actor, cycle.teamId);
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date(cycle.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : new Date(cycle.endDate);
    this.validateCycleDates(startDate, endDate);
    try {
      const [updated] = await this.database.db.update(cycles).set({
        name: dto.name === undefined ? undefined : dto.name.trim(),
        description: dto.description === undefined ? undefined : dto.description.trim() || null,
        capacity: dto.capacity === undefined ? undefined : dto.capacity,
        startDate: dto.startDate ? startDate : undefined,
        endDate: dto.endDate ? endDate : undefined,
        updatedAt: new Date(),
      }).where(eq(cycles.id, id)).returning();
      return updated;
    } catch (error) { this.rethrowCycleConflict(error); }
  }

  async completeCycle(id: string, dto: CompleteCycleDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const cycle = await requireCycle(this.database.db, actor, id);
    await requireTeamManager(this.database.db, actor, cycle.teamId);
    if (dto.nextCycleId) {
      const target = await requireCycle(this.database.db, actor, dto.nextCycleId);
      if (target.teamId !== cycle.teamId || target.id === cycle.id || target.isCompleted || new Date(target.startDate) < new Date(cycle.endDate)) {
        throw new BadRequestException('Rollover target must be an open, non-overlapping cycle in the same team');
      }
    }
    const result = await this.database.db.execute(sql`SELECT * FROM complete_reka_cycle(${id}::uuid, ${dto.incompleteIssuesAction}, ${dto.nextCycleId ?? null}::uuid)`);
    const row = result.rows[0] as { success: boolean; rolled_over_count: number; target_cycle_id: string | null; already_completed: boolean } | undefined;
    if (!row) throw new BadRequestException('Cycle could not be completed');
    return { success: row.success, rolledOverCount: row.rolled_over_count, targetCycleId: row.target_cycle_id, alreadyCompleted: row.already_completed, action: dto.incompleteIssuesAction };
  }

  async reopenCycle(id: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const cycle = await requireCycle(this.database.db, actor, id);
    await requireTeamManager(this.database.db, actor, cycle.teamId);
    if (!cycle.isCompleted) return { success: true, alreadyOpen: true };
    try {
      await this.database.db.update(cycles).set({ isCompleted: false, updatedAt: new Date() }).where(eq(cycles.id, id));
    } catch (error) { this.rethrowCycleConflict(error); }
    return { success: true, alreadyOpen: false };
  }

  async history(id: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireCycle(this.database.db, actor, id);
    const snapshots = await this.database.db.select().from(cycleSnapshots).where(eq(cycleSnapshots.cycleId, id)).orderBy(cycleSnapshots.snapshotAt).limit(500);
    return { snapshots, hasHistory: snapshots.length > 0, historyStartsAt: snapshots[0]?.snapshotAt ?? null };
  }

  async getTeamSettings(teamId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireTeam(this.database.db, actor, teamId);
    const [settings] = await this.database.db.select().from(teamCycleSettings).where(eq(teamCycleSettings.teamId, teamId));
    return settings ?? null;
  }

  async saveTeamSettings(teamId: string, dto: TeamCycleSettingsDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireTeamManager(this.database.db, actor, teamId);
    try { new Intl.DateTimeFormat('en-US', { timeZone: dto.timezone }); }
    catch { throw new BadRequestException('Timezone must be a valid IANA timezone'); }
    const parsedStart = new Date(`${dto.nextStartDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.nextStartDate) || Number.isNaN(parsedStart.getTime()) || parsedStart.toISOString().slice(0, 10) !== dto.nextStartDate) {
      throw new BadRequestException('Next cycle start must be a valid calendar date');
    }
    const [settings] = await this.database.db.insert(teamCycleSettings).values({
      teamId, timezone: dto.timezone, durationDays: dto.durationDays, cooldownDays: dto.cooldownDays,
      nextStartDate: dto.nextStartDate, autoCreate: dto.autoCreate, updatedBy: actorId,
    }).onConflictDoUpdate({
      target: teamCycleSettings.teamId,
      set: { timezone: dto.timezone, durationDays: dto.durationDays, cooldownDays: dto.cooldownDays,
        nextStartDate: dto.nextStartDate, autoCreate: dto.autoCreate, updatedBy: actorId, updatedAt: new Date() },
    }).returning();
    return settings;
  }

  async delete(id: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const cycle = await requireCycle(this.database.db, actor, id);
    await requireTeamManager(this.database.db, actor, cycle.teamId);
    await this.database.db.delete(cycles).where(eq(cycles.id, id));
    return { success: true };
  }
}
