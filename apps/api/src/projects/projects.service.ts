import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { projects, users, issues, projectRepositories, githubRepositories, projectMembers, milestones, projectDependencies, projectUpdates, projectUpdateSubscriptions } from '@reka/database';
import { eq, desc, asc, and, inArray, isNull } from 'drizzle-orm';
import { requireWorkspace, requireWrite, requireProject, requireProjectManager, requireTeamWrite, requireEligibleUser, requireIssueWrite, requireResourceId, projectScope, issueScope, userScope, repositoryScope } from '../common/access/workspace-access';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { loadIssueStatusCategories, getIssueStatusCategory } from '../issues/issue-status';
import { CreateMilestoneDto, CreateProjectUpdateDto, UpdateMilestoneDto, UpdateProjectUpdateDto } from './dto/project-workflows.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const projectList = await this.database.db
      .select()
      .from(projects)
      .where(projectScope(this.database.db, actor))
      .orderBy(desc(projects.createdAt));

    // Attach dynamic issue counts for each project
    const allIssues = await this.database.db.select().from(issues).where(and(issueScope(this.database.db, actor), isNull(issues.archivedAt)));
    const categories = await loadIssueStatusCategories(this.database.db, [...new Set(allIssues.map((issue) => issue.teamId))]);

    // Attach linked repositories for each project
    const allProjectRepos = await this.database.db
      .select({
        projectId: projectRepositories.projectId,
        id: githubRepositories.id,
        fullName: githubRepositories.fullName,
        name: githubRepositories.name,
        owner: githubRepositories.owner,
        isPrivate: githubRepositories.isPrivate,
        defaultBranch: githubRepositories.defaultBranch,
      })
      .from(projectRepositories)
      .innerJoin(githubRepositories, eq(projectRepositories.repositoryId, githubRepositories.id))
      .where(and(repositoryScope(this.database.db, actor), inArray(projectRepositories.projectId,
        this.database.db.select({ id: projects.id }).from(projects).where(projectScope(this.database.db, actor)))));

    return projectList.map((p) => {
      const pIssues = allIssues.filter((i) => i.projectId === p.id);
      const pRepos = allProjectRepos.filter((r) => r.projectId === p.id);
      const progressIssues = pIssues.filter((issue) => getIssueStatusCategory(issue, categories) !== 'canceled');
      const totalIssues = pIssues.length;
      const completedIssues = progressIssues.filter((issue) => getIssueStatusCategory(issue, categories) === 'completed').length;
      const progress = progressIssues.length > 0 ? Math.round((completedIssues / progressIssues.length) * 100) : 0;

      return {
        ...p,
        totalIssues,
        completedIssues,
        progress,
        repositories: pRepos,
      };
    });
  }

  async findById(id: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const p = await requireProject(this.database.db, actor, id);
    const pIssues = await this.database.db.select().from(issues).where(and(eq(issues.projectId, p.id), issueScope(this.database.db, actor), isNull(issues.archivedAt)));
    const pRepos = await this.findRepositories(p.id, actorId);
    const totalIssues = pIssues.length;
    const categories = await loadIssueStatusCategories(this.database.db, [...new Set(pIssues.map((issue) => issue.teamId))]);
    const progressIssues = pIssues.filter((issue) => getIssueStatusCategory(issue, categories) !== 'canceled');
    const completedIssues = progressIssues.filter((issue) => getIssueStatusCategory(issue, categories) === 'completed').length;
    const progress = progressIssues.length > 0 ? Math.round((completedIssues / progressIssues.length) * 100) : 0;

    return {
      ...p,
      issues: pIssues,
      repositories: pRepos,
      totalIssues,
      completedIssues,
      progress,
    };
  }

  async findRepositories(projectId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireProject(this.database.db, actor, projectId);
    return this.database.db
      .select({
        id: githubRepositories.id,
        repoId: githubRepositories.repoId,
        owner: githubRepositories.owner,
        name: githubRepositories.name,
        fullName: githubRepositories.fullName,
        isPrivate: githubRepositories.isPrivate,
        defaultBranch: githubRepositories.defaultBranch,
        createdAt: projectRepositories.createdAt,
      })
      .from(projectRepositories)
      .innerJoin(githubRepositories, eq(projectRepositories.repositoryId, githubRepositories.id))
      .where(and(eq(projectRepositories.projectId, projectId), repositoryScope(this.database.db, actor)));
  }

  async addRepository(projectId: string, repositoryId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireProjectManager(this.database.db, actor, projectId);
    const repo = await this.database.db.select().from(githubRepositories).where(and(eq(githubRepositories.id, repositoryId), repositoryScope(this.database.db, actor)));
    if (!repo.length) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found`);
    }

    // Check if already linked
    const existing = await this.database.db
      .select()
      .from(projectRepositories)
      .where(
        and(
          eq(projectRepositories.projectId, projectId),
          eq(projectRepositories.repositoryId, repositoryId),
        ),
      );

    if (existing.length === 0) {
      await this.database.db.insert(projectRepositories).values({
        projectId,
        repositoryId,
      });
    }

    return { success: true };
  }

  async removeRepository(projectId: string, repositoryId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireProjectManager(this.database.db, actor, projectId);
    await this.database.db
      .delete(projectRepositories)
      .where(
        and(
          eq(projectRepositories.projectId, projectId),
          eq(projectRepositories.repositoryId, repositoryId),
        ),
      );

    return { success: true };
  }

  private validateProjectDates(startDate?: Date | null, targetDate?: Date | null) {
    if (startDate && targetDate && startDate.getTime() > targetDate.getTime()) {
      throw new BadRequestException('Project start date must be on or before its target date');
    }
  }

  async create(dto: CreateProjectDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const team = await requireTeamWrite(this.database.db, actor, dto.teamId);

    const startDate = dto.startDate ? new Date(dto.startDate) : null;
    const targetDate = dto.targetDate ? new Date(dto.targetDate) : null;
    this.validateProjectDates(startDate, targetDate);

    // 4. Generate Slug
    const slug =
      dto.slug ||
      dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') ||
      'project';

    const [created] = await this.database.db
      .insert(projects)
      .values({
        organizationId: actor.organizationId,
        ownerId: actorId,
        teamId: team.id,
        name: dto.name,
        icon: dto.icon,
        slug,
        description: dto.description || null,
        status: dto.status || 'planned',
        health: dto.health || 'on_track',
        priority: dto.priority || 'medium',
        startDate,
        targetDate,
      })
      .returning();

    await this.database.db.insert(projectMembers).values({
      projectId: created.id,
      userId: actorId,
      role: 'owner',
    }).onConflictDoNothing();
    await this.database.db.insert(projectUpdateSubscriptions).values({ projectId: created.id, userId: actorId }).onConflictDoNothing();

    return created;
  }

  async findMembers(projectId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const project = await requireProject(this.database.db, actor, projectId);
    const members = await this.database.db
      .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl, role: projectMembers.role })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(and(eq(projectMembers.projectId, projectId), userScope(this.database.db, actor)));

    if (!members.some((member) => member.id === project.ownerId)) {
      const [owner] = await this.database.db.select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
        .from(users).where(and(eq(users.id, project.ownerId), userScope(this.database.db, actor)));
      if (owner) members.unshift({ ...owner, role: 'owner' });
    }
    return members;
  }

  async addMember(projectId: string, userId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const project = await requireProjectManager(this.database.db, actor, projectId);
    await requireEligibleUser(this.database.db, actor, userId, project.teamId ?? undefined);

    const [added] = await this.database.db
      .insert(projectMembers)
      .values({ projectId, userId, role: 'member' })
      .onConflictDoNothing()
      .returning();

    if (added) await this.database.db.insert(projectUpdateSubscriptions).values({ projectId, userId }).onConflictDoNothing();
    if (added && userId !== actorId) {
      await this.notificationsService.createForEvent(userId, {
        type: 'project_invite',
        title: `Added to ${project.name}`,
        body: `You were added to project ${project.name}.`,
        link: `/projects/${projectId}`,
        metadata: { projectId, projectName: project.name },
      });
    }

    return { success: true, added: Boolean(added) };
  }

  async removeMember(projectId: string, userId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const project = await requireProjectManager(this.database.db, actor, projectId);
    requireResourceId(userId);
    if (userId === project.ownerId) throw new BadRequestException('Change the project lead before removing them from the project');
    const [member] = await this.database.db.select({ userId: projectMembers.userId }).from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
    if (!member) throw new NotFoundException('Project member not found');
    await this.database.db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
    await this.database.db.delete(projectUpdateSubscriptions).where(and(eq(projectUpdateSubscriptions.projectId, projectId), eq(projectUpdateSubscriptions.userId, userId)));
    return { success: true };
  }

  async update(id: string, dto: UpdateProjectDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    requireWrite(actor);
    const project = await requireProject(this.database.db, actor, id);
    if (project.teamId) await requireTeamWrite(this.database.db, actor, project.teamId);
    if (dto.teamId !== undefined && dto.teamId !== project.teamId) {
      await requireProjectManager(this.database.db, actor, id);
      if (dto.teamId) await requireTeamWrite(this.database.db, actor, dto.teamId);
      const [linkedIssue] = await this.database.db.select({ id: issues.id }).from(issues).where(eq(issues.projectId, id)).limit(1);
      if (linkedIssue) throw new BadRequestException('Move linked issues before changing the project team');
    }

    if (dto.ownerId !== undefined && dto.ownerId !== project.ownerId) {
      await requireProjectManager(this.database.db, actor, id);
      await requireEligibleUser(this.database.db, actor, dto.ownerId, dto.teamId ?? project.teamId ?? undefined);
    }
    const startDate = dto.startDate === undefined ? project.startDate : dto.startDate ? new Date(dto.startDate) : null;
    const targetDate = dto.targetDate === undefined ? project.targetDate : dto.targetDate ? new Date(dto.targetDate) : null;
    this.validateProjectDates(startDate, targetDate);
    const [updated] = await this.database.db
      .update(projects)
      .set({
        ...dto,
        startDate,
        targetDate,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    if (dto.ownerId && dto.ownerId !== project.ownerId) {
      await this.database.db.update(projectMembers).set({ role: 'member' }).where(and(
        eq(projectMembers.projectId, id), eq(projectMembers.userId, project.ownerId), eq(projectMembers.role, 'owner'),
      ));
      await this.database.db.insert(projectMembers).values({ projectId: id, userId: dto.ownerId, role: 'owner' })
        .onConflictDoUpdate({ target: [projectMembers.projectId, projectMembers.userId], set: { role: 'owner' } });
      await this.database.db.insert(projectUpdateSubscriptions).values({ projectId: id, userId: dto.ownerId }).onConflictDoNothing();
    }
    return updated;
  }

  async listMilestones(projectId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireProject(this.database.db, actor, projectId);
    const [rows, linkedIssues] = await Promise.all([
      this.database.db.select().from(milestones).where(eq(milestones.projectId, projectId))
        .orderBy(asc(milestones.position), asc(milestones.createdAt)).limit(200),
      this.database.db.select().from(issues).where(and(eq(issues.projectId, projectId), issueScope(this.database.db, actor), isNull(issues.archivedAt))),
    ]);
    const categories = await loadIssueStatusCategories(this.database.db, [...new Set(linkedIssues.map((issue) => issue.teamId))]);
    return rows.map((milestone) => {
      const assigned = linkedIssues.filter((issue) => issue.milestoneId === milestone.id && getIssueStatusCategory(issue, categories) !== 'canceled');
      const completedIssues = assigned.filter((issue) => getIssueStatusCategory(issue, categories) === 'completed').length;
      return { ...milestone, totalIssues: assigned.length, completedIssues,
        progress: assigned.length ? Math.round(completedIssues / assigned.length * 100) : 0,
        isComplete: assigned.length > 0 && completedIssues === assigned.length };
    });
  }

  async createMilestone(projectId: string, dto: CreateMilestoneDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const project = await requireProjectManager(this.database.db, actor, projectId);
    if (project.teamId) await requireTeamWrite(this.database.db, actor, project.teamId);
    const [last] = await this.database.db.select({ position: milestones.position }).from(milestones)
      .where(eq(milestones.projectId, projectId)).orderBy(desc(milestones.position)).limit(1);
    const [created] = await this.database.db.insert(milestones).values({
      projectId, name: dto.name.trim(), description: dto.description?.trim() || null,
      targetDate: dto.targetDate ? new Date(dto.targetDate) : null, position: (last?.position ?? -1) + 1,
    }).returning();
    return created;
  }

  async updateMilestone(projectId: string, milestoneId: string, dto: UpdateMilestoneDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const project = await requireProjectManager(this.database.db, actor, projectId);
    if (project.teamId) await requireTeamWrite(this.database.db, actor, project.teamId);
    requireResourceId(milestoneId);
    const [milestone] = await this.database.db.select().from(milestones)
      .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, projectId)));
    if (!milestone) throw new NotFoundException('Milestone not found');
    const changes = {
      name: dto.name === undefined ? undefined : dto.name.trim(),
      description: dto.description === undefined ? undefined : dto.description?.trim() || null,
      targetDate: dto.targetDate === undefined ? undefined : dto.targetDate ? new Date(dto.targetDate) : null,
      updatedAt: new Date(),
    };
    if (dto.position !== undefined) {
      const siblings = await this.database.db.select({ id: milestones.id }).from(milestones)
        .where(eq(milestones.projectId, projectId)).orderBy(asc(milestones.position), asc(milestones.createdAt));
      const from = siblings.findIndex((item) => item.id === milestoneId);
      const [moving] = siblings.splice(from, 1);
      siblings.splice(Math.max(0, Math.min(dto.position, siblings.length)), 0, moving);
      for (const [position, item] of siblings.entries()) {
        await this.database.db.update(milestones).set({ ...(item.id === milestoneId ? changes : {}), position, updatedAt: new Date() })
          .where(eq(milestones.id, item.id));
      }
      const [updated] = await this.database.db.select().from(milestones).where(eq(milestones.id, milestoneId));
      return updated;
    }
    const [updated] = await this.database.db.update(milestones).set(changes).where(eq(milestones.id, milestoneId)).returning();
    return updated;
  }

  async deleteMilestone(projectId: string, milestoneId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const project = await requireProjectManager(this.database.db, actor, projectId);
    if (project.teamId) await requireTeamWrite(this.database.db, actor, project.teamId);
    requireResourceId(milestoneId);
    const [milestone] = await this.database.db.select({ id: milestones.id }).from(milestones)
      .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, projectId)));
    if (!milestone) throw new NotFoundException('Milestone not found');
    await this.database.db.delete(milestones).where(eq(milestones.id, milestoneId));
    return { success: true };
  }

  async setIssueMilestone(projectId: string, milestoneId: string | null, issueId: string, actorId: string, expectedMilestoneId?: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireProject(this.database.db, actor, projectId);
    const issue = await requireIssueWrite(this.database.db, actor, issueId);
    if (issue.projectId !== projectId) throw new BadRequestException('Issue must belong to this project');
    if (expectedMilestoneId) {
      requireResourceId(expectedMilestoneId);
      if (issue.milestoneId !== expectedMilestoneId) throw new NotFoundException('Milestone assignment not found');
      const [expected] = await this.database.db.select({ id: milestones.id }).from(milestones)
        .where(and(eq(milestones.id, expectedMilestoneId), eq(milestones.projectId, projectId)));
      if (!expected) throw new NotFoundException('Milestone not found');
    }
    if (milestoneId) {
      requireResourceId(milestoneId);
      const [milestone] = await this.database.db.select({ id: milestones.id }).from(milestones)
        .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, projectId)));
      if (!milestone) throw new BadRequestException('Milestone must belong to this project');
    }
    const [updated] = await this.database.db.update(issues).set({ milestoneId, updatedAt: new Date() })
      .where(eq(issues.id, issueId)).returning();
    return updated;
  }

  async listDependencies(projectId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireProject(this.database.db, actor, projectId);
    const [dependsOn, blockedBy] = await Promise.all([
      this.database.db.select({ id: projects.id, name: projects.name, status: projects.status, targetDate: projects.targetDate })
        .from(projectDependencies).innerJoin(projects, eq(projectDependencies.dependsOnProjectId, projects.id))
        .where(and(eq(projectDependencies.projectId, projectId), projectScope(this.database.db, actor))),
      this.database.db.select({ id: projects.id, name: projects.name, status: projects.status, targetDate: projects.targetDate })
        .from(projectDependencies).innerJoin(projects, eq(projectDependencies.projectId, projects.id))
        .where(and(eq(projectDependencies.dependsOnProjectId, projectId), projectScope(this.database.db, actor))),
    ]);
    return { dependsOn, blockedBy };
  }

  async addDependency(projectId: string, dependsOnProjectId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireProjectManager(this.database.db, actor, projectId);
    await requireProject(this.database.db, actor, dependsOnProjectId);
    if (projectId === dependsOnProjectId) throw new BadRequestException('A project cannot depend on itself');
    const visible = await this.database.db.select({ id: projects.id }).from(projects).where(projectScope(this.database.db, actor));
    const ids = visible.map((item) => item.id);
    const edges = await this.database.db.select({ projectId: projectDependencies.projectId, dependsOnProjectId: projectDependencies.dependsOnProjectId })
      .from(projectDependencies).where(and(inArray(projectDependencies.projectId, ids), inArray(projectDependencies.dependsOnProjectId, ids)));
    const graph = new Map<string, string[]>();
    for (const edge of edges) graph.set(edge.projectId, [...(graph.get(edge.projectId) ?? []), edge.dependsOnProjectId]);
    const seen = new Set<string>();
    const pending = [dependsOnProjectId];
    while (pending.length) {
      const current = pending.pop()!;
      if (current === projectId) throw new BadRequestException('This dependency would create a project cycle');
      if (seen.has(current)) continue;
      seen.add(current);
      pending.push(...(graph.get(current) ?? []));
    }
    const [created] = await this.database.db.insert(projectDependencies).values({ projectId, dependsOnProjectId, createdBy: actorId })
      .onConflictDoNothing().returning();
    return { success: true, added: Boolean(created) };
  }

  async removeDependency(projectId: string, dependsOnProjectId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireProjectManager(this.database.db, actor, projectId);
    await requireProject(this.database.db, actor, dependsOnProjectId);
    await this.database.db.delete(projectDependencies).where(and(
      eq(projectDependencies.projectId, projectId), eq(projectDependencies.dependsOnProjectId, dependsOnProjectId),
    ));
    return { success: true };
  }

  async getUpdateSubscription(projectId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireProject(this.database.db, actor, projectId);
    const [subscription] = await this.database.db.select({ userId: projectUpdateSubscriptions.userId }).from(projectUpdateSubscriptions)
      .where(and(eq(projectUpdateSubscriptions.projectId, projectId), eq(projectUpdateSubscriptions.userId, actorId)));
    return { subscribed: Boolean(subscription) };
  }

  async setUpdateSubscription(projectId: string, actorId: string, subscribed: boolean) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireProject(this.database.db, actor, projectId);
    requireWrite(actor);
    if (subscribed) await this.database.db.insert(projectUpdateSubscriptions).values({ projectId, userId: actorId }).onConflictDoNothing();
    else await this.database.db.delete(projectUpdateSubscriptions).where(and(
      eq(projectUpdateSubscriptions.projectId, projectId), eq(projectUpdateSubscriptions.userId, actorId),
    ));
    return { subscribed };
  }

  async listUpdates(projectId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireProject(this.database.db, actor, projectId);
    return this.database.db.select({
      id: projectUpdates.id, projectId: projectUpdates.projectId, authorId: projectUpdates.authorId,
      authorName: users.name, authorAvatarUrl: users.avatarUrl, health: projectUpdates.health,
      body: projectUpdates.body, createdAt: projectUpdates.createdAt, updatedAt: projectUpdates.updatedAt,
    }).from(projectUpdates).innerJoin(users, eq(projectUpdates.authorId, users.id))
      .where(eq(projectUpdates.projectId, projectId)).orderBy(desc(projectUpdates.createdAt)).limit(50);
  }

  async createUpdate(projectId: string, dto: CreateProjectUpdateDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const project = await requireProject(this.database.db, actor, projectId);
    requireWrite(actor);
    if (project.teamId) await requireTeamWrite(this.database.db, actor, project.teamId);
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('Update body is required');
    const [created] = await this.database.db.insert(projectUpdates).values({ projectId, authorId: actorId, health: dto.health, body }).returning();
    await this.database.db.update(projects).set({ health: dto.health, updatedAt: new Date() }).where(eq(projects.id, projectId));
    const subscribers = await this.database.db.select({ userId: projectUpdateSubscriptions.userId }).from(projectUpdateSubscriptions)
      .where(eq(projectUpdateSubscriptions.projectId, projectId)).limit(500);
    for (const { userId } of subscribers) {
      if (userId === actorId) continue;
      try {
        const recipient = await requireWorkspace(this.database.db, userId);
        await requireProject(this.database.db, recipient, projectId);
        await this.notificationsService.createForEvent(userId, {
        type: 'project_update', title: `Update for ${project.name}`, body: body.slice(0, 180),
        link: `/projects/${projectId}`, metadata: { projectId, updateId: created.id },
        });
      } catch (error) {
        if (error instanceof ForbiddenException || error instanceof NotFoundException) continue;
        // Notification delivery cannot undo the saved update.
      }
    }
    return created;
  }

  async updateUpdate(projectId: string, updateId: string, dto: UpdateProjectUpdateDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const project = await requireProject(this.database.db, actor, projectId);
    requireWrite(actor);
    if (project.teamId) await requireTeamWrite(this.database.db, actor, project.teamId);
    requireResourceId(updateId);
    const [existing] = await this.database.db.select().from(projectUpdates)
      .where(and(eq(projectUpdates.id, updateId), eq(projectUpdates.projectId, projectId)));
    if (!existing) throw new NotFoundException('Project update not found');
    if (existing.authorId !== actorId) await requireProjectManager(this.database.db, actor, projectId);
    const body = dto.body === undefined ? existing.body : dto.body.trim();
    if (!body) throw new BadRequestException('Update body is required');
    const health = dto.health ?? existing.health;
    const [updated] = await this.database.db.update(projectUpdates).set({ body, health, updatedAt: new Date() })
      .where(eq(projectUpdates.id, updateId)).returning();
    const [latest] = await this.database.db.select({ health: projectUpdates.health }).from(projectUpdates)
      .where(eq(projectUpdates.projectId, projectId)).orderBy(desc(projectUpdates.createdAt)).limit(1);
    await this.database.db.update(projects).set({ health: latest?.health ?? health, updatedAt: new Date() }).where(eq(projects.id, projectId));
    return updated;
  }

  async delete(id: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireProjectManager(this.database.db, actor, id);
    await this.database.db.delete(projects).where(eq(projects.id, id));
    return { success: true };
  }
}
