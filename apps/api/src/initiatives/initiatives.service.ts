import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { initiatives, initiativeProjects, issues, milestones, projectDependencies, projects } from '@reka/database';
import { DatabaseService } from '../common/database/database.service';
import { requireProject, requireProjectManager, requireWorkspace, requireWrite, issueScope, projectScope } from '../common/access/workspace-access';
import { getIssueStatusCategory, loadIssueStatusCategories } from '../issues/issue-status';
import type { WorkspaceActor } from '../common/access/workspace-access';
import { CreateInitiativeDto, UpdateInitiativeDto } from './dto/initiative.dto';

@Injectable()
export class InitiativesService {
  constructor(private readonly database: DatabaseService) {}

  private validateDates(startDate: Date | null, targetDate: Date | null) {
    if (startDate && targetDate && startDate > targetDate) throw new BadRequestException('Start date must not be after target date');
  }

  private async requireInitiative(actor: WorkspaceActor, id: string) {
    const [initiative] = await this.database.db.select().from(initiatives)
      .where(and(eq(initiatives.id, id), eq(initiatives.organizationId, actor.organizationId)));
    if (!initiative) throw new NotFoundException('Initiative not found');
    return initiative;
  }

  private async getVisibleProjectMetrics(actor: WorkspaceActor, visibleProjects: Array<typeof projects.$inferSelect>) {
    if (!visibleProjects.length) return new Map<string, { totalIssues: number; completedIssues: number; progress: number | null }>();
    const projectIds = visibleProjects.map((project) => project.id);
    const linkedIssues = await this.database.db.select().from(issues).where(and(
      inArray(issues.projectId, projectIds), issueScope(this.database.db, actor), isNull(issues.archivedAt),
    ));
    const categories = await loadIssueStatusCategories(this.database.db, [...new Set(linkedIssues.map((issue) => issue.teamId))]);
    const metrics = new Map<string, { totalIssues: number; completedIssues: number; progress: number | null }>();
    for (const project of visibleProjects) {
      const activeIssues = linkedIssues.filter((issue) => issue.projectId === project.id && getIssueStatusCategory(issue, categories) !== 'canceled');
      const completedIssues = activeIssues.filter((issue) => getIssueStatusCategory(issue, categories) === 'completed').length;
      metrics.set(project.id, { totalIssues: activeIssues.length, completedIssues, progress: activeIssues.length ? Math.round(completedIssues / activeIssues.length * 100) : null });
    }
    return metrics;
  }

  private async listForActor(actor: WorkspaceActor) {
    const rows = await this.database.db.select().from(initiatives)
      .where(eq(initiatives.organizationId, actor.organizationId)).orderBy(desc(initiatives.updatedAt)).limit(200);
    if (!rows.length) return [];
    const rowIds = rows.map((row) => row.id);
    const projectsVisible = await this.database.db.select().from(projects).where(projectScope(this.database.db, actor));
    const visibleProjectIds = new Set(projectsVisible.map((project) => project.id));
    const metrics = await this.getVisibleProjectMetrics(actor, projectsVisible);
    const links = await this.database.db.select({ initiativeId: initiativeProjects.initiativeId, projectId: initiativeProjects.projectId })
      .from(initiativeProjects).innerJoin(projects, eq(initiativeProjects.projectId, projects.id))
      .where(and(inArray(initiativeProjects.initiativeId, rowIds), projectScope(this.database.db, actor)));
    return rows.map((row) => {
      const visibleLinks = links.filter((link) => link.initiativeId === row.id && visibleProjectIds.has(link.projectId));
      const linkedProjects = visibleLinks.map(({ projectId }) => {
        const project = projectsVisible.find((candidate) => candidate.id === projectId)!;
        const projectMetrics = metrics.get(projectId)!;
        return { id: project.id, name: project.name, status: project.status, health: project.health, startDate: project.startDate, targetDate: project.targetDate, ...projectMetrics };
      }).sort((a, b) => (a.startDate?.getTime() ?? Infinity) - (b.startDate?.getTime() ?? Infinity) || a.name.localeCompare(b.name));
      const measurableProjects = linkedProjects.filter((project) => project.progress !== null);
      const totalIssues = measurableProjects.reduce((total, project) => total + project.totalIssues, 0);
      const completedIssues = measurableProjects.reduce((total, project) => total + project.completedIssues, 0);
      return {
        ...row, projects: linkedProjects, projectCount: linkedProjects.length,
        totalIssues, completedIssues, progress: totalIssues ? Math.round(completedIssues / totalIssues * 100) : null,
      };
    });
  }

  async list(actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    return this.listForActor(actor);
  }

  async findById(id: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await this.requireInitiative(actor, id);
    const [initiative] = (await this.listForActor(actor)).filter((row) => row.id === id);
    if (!initiative) throw new NotFoundException('Initiative not found');
    return initiative;
  }

  async create(dto: CreateInitiativeDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    requireWrite(actor);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Initiative name is required');
    const startDate = dto.startDate ? new Date(dto.startDate) : null;
    const targetDate = dto.targetDate ? new Date(dto.targetDate) : null;
    this.validateDates(startDate, targetDate);
    const [created] = await this.database.db.insert(initiatives).values({
      organizationId: actor.organizationId, ownerId: actor.userId, name, description: dto.description?.trim() ?? '',
      status: dto.status ?? 'planned', health: dto.health ?? 'on_track', startDate, targetDate,
    }).returning();
    return this.findById(created.id, actorId);
  }

  async update(id: string, dto: UpdateInitiativeDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    requireWrite(actor);
    const initiative = await this.requireInitiative(actor, id);
    if (initiative.ownerId !== actor.userId && actor.role !== 'owner' && actor.role !== 'admin') {
      throw new ForbiddenException('Initiative owner or workspace administrator permission required');
    }
    const startDate = dto.startDate === undefined ? initiative.startDate : dto.startDate ? new Date(dto.startDate) : null;
    const targetDate = dto.targetDate === undefined ? initiative.targetDate : dto.targetDate ? new Date(dto.targetDate) : null;
    this.validateDates(startDate, targetDate);
    const name = dto.name === undefined ? initiative.name : dto.name.trim();
    if (!name) throw new BadRequestException('Initiative name is required');
    await this.database.db.update(initiatives).set({
      ...dto, name, description: dto.description === undefined ? initiative.description : dto.description.trim(),
      startDate, targetDate, updatedAt: new Date(),
    }).where(eq(initiatives.id, id));
    return this.findById(id, actorId);
  }

  async addProject(id: string, projectId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    requireWrite(actor);
    await this.requireInitiative(actor, id);
    const project = await requireProjectManager(this.database.db, actor, projectId);
    if (project.organizationId !== actor.organizationId) throw new NotFoundException('Project not found');
    await this.database.db.insert(initiativeProjects).values({ initiativeId: id, projectId, createdBy: actorId }).onConflictDoNothing();
    return this.findById(id, actorId);
  }

  async removeProject(id: string, projectId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    requireWrite(actor);
    await this.requireInitiative(actor, id);
    await requireProjectManager(this.database.db, actor, projectId);
    await this.database.db.delete(initiativeProjects).where(and(eq(initiativeProjects.initiativeId, id), eq(initiativeProjects.projectId, projectId)));
    return this.findById(id, actorId);
  }

  async delete(id: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    requireWrite(actor);
    const initiative = await this.requireInitiative(actor, id);
    if (initiative.ownerId !== actor.userId && actor.role !== 'owner' && actor.role !== 'admin') {
      throw new ForbiddenException('Initiative owner or workspace administrator permission required');
    }
    await this.database.db.delete(initiatives).where(eq(initiatives.id, id));
    return { success: true };
  }

  async roadmap(actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const visibleProjects = await this.database.db.select().from(projects).where(projectScope(this.database.db, actor));
    const projectIds = visibleProjects.map((project) => project.id);
    const metrics = await this.getVisibleProjectMetrics(actor, visibleProjects);
    const [visibleMilestones, visibleDependencies, initiativeRows] = await Promise.all([
      projectIds.length ? this.database.db.select().from(milestones).where(inArray(milestones.projectId, projectIds)).orderBy(asc(milestones.targetDate), asc(milestones.position)) : [],
      projectIds.length ? this.database.db.select().from(projectDependencies).where(and(
        inArray(projectDependencies.projectId, projectIds), inArray(projectDependencies.dependsOnProjectId, projectIds),
      )) : [],
      this.listForActor(actor),
    ]);
    const projectItems = visibleProjects.map((project) => ({
      id: project.id, name: project.name, status: project.status, health: project.health, teamId: project.teamId,
      startDate: project.startDate, targetDate: project.targetDate,
      scheduled: Boolean(project.startDate && project.targetDate), ...metrics.get(project.id)!,
    })).sort((a, b) => (a.startDate?.getTime() ?? Infinity) - (b.startDate?.getTime() ?? Infinity) || a.name.localeCompare(b.name));
    const visibleIds = new Set(projectIds);
    return {
      initiatives: initiativeRows,
      projects: projectItems,
      milestones: visibleMilestones.map((milestone) => ({ ...milestone, projectName: visibleProjects.find((project) => project.id === milestone.projectId)?.name ?? '' })),
      dependencies: visibleDependencies.filter((edge) => visibleIds.has(edge.projectId) && visibleIds.has(edge.dependsOnProjectId)).map((edge) => ({
        projectId: edge.projectId, dependsOnProjectId: edge.dependsOnProjectId,
        projectName: visibleProjects.find((project) => project.id === edge.projectId)?.name ?? '',
        dependsOnProjectName: visibleProjects.find((project) => project.id === edge.dependsOnProjectId)?.name ?? '',
      })),
    };
  }
}
