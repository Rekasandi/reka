import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import {
  documents, issues, labels, projects, savedViews, teamMembers, teams, userFavorites, users,
  type SavedIssueViewConfig,
} from '@reka/database';
import {
  documentScope, labelScope, projectScope, requireAdmin, requireDocument, requireIssue, requireProject, requireResourceId,
  requireTeam, requireTeamWrite, requireWorkspace, requireWrite, teamManagerScope,
  userScope, visibleTeamIds,
} from '../common/access/workspace-access';
import { DatabaseService } from '../common/database/database.service';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'no_priority'];
const EMPTY_CONFIG: SavedIssueViewConfig = {
  filterTab: 'all', viewMode: 'grouped', groupBy: 'status', sortBy: 'manual', showSubtasks: true,
  filters: { assigneeIds: [], labelIds: [], priorities: [], projectIds: [] },
};

@Injectable()
export class ViewsService {
  constructor(private readonly database: DatabaseService) {}
  private get db() { return this.database.db; }

  private validateConfig(input: unknown): SavedIssueViewConfig {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Invalid view configuration');
    const value = input as Record<string, unknown>;
    if (Object.keys(value).some(key => !['filterTab', 'viewMode', 'groupBy', 'sortBy', 'showSubtasks', 'filters'].includes(key))) throw new BadRequestException('Unknown view configuration field');
    const config = { ...EMPTY_CONFIG, ...value } as SavedIssueViewConfig;
    if (!['all', 'active', 'backlog', 'done', 'archived'].includes(config.filterTab) ||
        !['grouped', 'list', 'board'].includes(config.viewMode) || !['status', 'none'].includes(config.groupBy) ||
        (config.viewMode === 'board' && config.groupBy === 'none') ||
        !['manual', 'updated', 'priority', 'dueDate'].includes(config.sortBy) || typeof config.showSubtasks !== 'boolean') {
      throw new BadRequestException('Invalid view mode, filter, grouping, or sort option');
    }
    const filters = value.filters === undefined ? EMPTY_CONFIG.filters : value.filters;
    if (!filters || typeof filters !== 'object' || Array.isArray(filters) ||
        Object.keys(filters).some(key => !['assigneeIds', 'labelIds', 'priorities', 'projectIds'].includes(key))) {
      throw new BadRequestException('Invalid view filters');
    }
    const source = filters as Record<string, unknown>;
    const readIds = (key: 'assigneeIds' | 'labelIds' | 'projectIds') => {
      const ids = source[key] ?? [];
      if (!Array.isArray(ids) || ids.length > 50 || ids.some(id => typeof id !== 'string' || !ID.test(id))) throw new BadRequestException(`Invalid ${key} filter`);
      return [...new Set(ids as string[])];
    };
    if (source.priorities !== undefined && (!Array.isArray(source.priorities) || source.priorities.length > PRIORITIES.length || source.priorities.some(value => !PRIORITIES.includes(String(value))))) {
      throw new BadRequestException('Invalid priorities filter');
    }
    return { ...config, filters: {
      assigneeIds: readIds('assigneeIds'), labelIds: readIds('labelIds'), projectIds: readIds('projectIds'),
      priorities: source.priorities === undefined ? [] : [...new Set(source.priorities as string[])],
    } };
  }

  private async canManage(view: typeof savedViews.$inferSelect, actor: Awaited<ReturnType<typeof requireWorkspace>>) {
    if (view.teamId) {
      const [membership] = await this.db.select({ role: teamMembers.role }).from(teamMembers)
        .where(and(eq(teamMembers.teamId, view.teamId), eq(teamMembers.userId, actor.userId)));
      if (membership?.role === 'viewer') return false;
    }
    if (view.ownerId === actor.userId) return true;
    if (view.visibility !== 'shared') return false;
    if (!view.teamId) return actor.role === 'owner' || actor.role === 'admin';
    const [team] = await this.db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, view.teamId), teamManagerScope(this.db, actor)));
    return !!team;
  }

  private async readableViews(actorId: string, teamId?: string) {
    const actor = await requireWorkspace(this.db, actorId);
    if (teamId) await requireTeam(this.db, actor, teamId);
    const teamVisibility = teamId
      ? or(isNull(savedViews.teamId), eq(savedViews.teamId, teamId))
      : or(isNull(savedViews.teamId), inArray(savedViews.teamId, visibleTeamIds(this.db, actor)));
    const rows = await this.db.select().from(savedViews).where(and(
      eq(savedViews.organizationId, actor.organizationId), teamVisibility,
      or(eq(savedViews.visibility, 'shared'), eq(savedViews.ownerId, actor.userId)),
    )).orderBy(desc(savedViews.updatedAt)).limit(100);
    return { actor, rows };
  }

  private async sanitizeConfigs(rows: (typeof savedViews.$inferSelect)[], actor: Awaited<ReturnType<typeof requireWorkspace>>) {
    if (!rows.length) return [];
    const requestedPeople = [...new Set(rows.flatMap(view => view.config.filters.assigneeIds))];
    const requestedLabels = [...new Set(rows.flatMap(view => view.config.filters.labelIds))];
    const requestedProjects = [...new Set(rows.flatMap(view => view.config.filters.projectIds))];
    const [people, visibleLabels, visibleProjects] = await Promise.all([
      requestedPeople.length ? this.db.select({ id: users.id }).from(users).where(and(inArray(users.id, requestedPeople), userScope(this.db, actor))) : [],
      requestedLabels.length ? this.db.select({ id: labels.id }).from(labels).where(and(inArray(labels.id, requestedLabels), labelScope(this.db, actor))) : [],
      requestedProjects.length ? this.db.select({ id: projects.id }).from(projects).where(and(inArray(projects.id, requestedProjects), projectScope(this.db, actor))) : [],
    ]);
    const peopleIds = new Set(people.map(item => item.id));
    const labelIds = new Set(visibleLabels.map(item => item.id));
    const projectIds = new Set(visibleProjects.map(item => item.id));
    return Promise.all(rows.map(async view => {
      const canEdit = await this.canManage(view, actor);
      return { ...view, config: { ...view.config, filters: {
        ...view.config.filters,
        assigneeIds: view.config.filters.assigneeIds.filter(id => peopleIds.has(id)),
        labelIds: view.config.filters.labelIds.filter(id => labelIds.has(id)),
        projectIds: view.config.filters.projectIds.filter(id => projectIds.has(id)),
      } }, canEdit };
    }));
  }

  async list(actorId: string, teamId?: string) {
    const { actor, rows } = await this.readableViews(actorId, teamId);
    return this.sanitizeConfigs(rows, actor);
  }

  private async validateFilterAccess(config: SavedIssueViewConfig, actor: Awaited<ReturnType<typeof requireWorkspace>>, teamId?: string) {
    const { assigneeIds, labelIds, projectIds } = config.filters;
    for (const id of assigneeIds) {
      const [user] = await this.db.select({ id: users.id }).from(users).where(and(eq(users.id, id), userScope(this.db, actor)));
      if (!user) throw new BadRequestException('Assignee filter must reference a visible workspace member');
      if (teamId) {
        const team = await requireTeam(this.db, actor, teamId);
        if (team.isPrivate) {
          const [member] = await this.db.select({ userId: teamMembers.userId }).from(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, id))).limit(1);
          if (!member) throw new BadRequestException('Assignee filter must reference a member of this private team');
        }
      }
    }
    if (labelIds.length) {
      const found = await this.db.select({ id: labels.id }).from(labels).where(and(inArray(labels.id, labelIds), labelScope(this.db, actor)));
      if (found.length !== labelIds.length) throw new BadRequestException('Label filters must reference visible labels');
    }
    if (projectIds.length) {
      const found = await this.db.select({ id: projects.id }).from(projects).where(and(
        inArray(projects.id, projectIds), projectScope(this.db, actor), ...(teamId ? [eq(projects.teamId, teamId)] : []),
      ));
      if (found.length !== projectIds.length) throw new BadRequestException('Project filters must reference visible projects in this team');
    }
  }

  async create(actorId: string, input: { name: string; teamId?: string; visibility: 'private' | 'shared'; config: unknown }) {
    const actor = await requireWorkspace(this.db, actorId);
    requireWrite(actor);
    const name = input.name.trim();
    if (!name) throw new BadRequestException('View name is required');
    if (input.teamId) await requireTeamWrite(this.db, actor, input.teamId);
    if (input.visibility === 'shared') {
      if (input.teamId) {
        const [team] = await this.db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, input.teamId), teamManagerScope(this.db, actor)));
        if (!team) throw new ForbiddenException('Only team leads or workspace administrators can publish team views');
      } else requireAdmin(actor);
    }
    const config = this.validateConfig(input.config);
    await this.validateFilterAccess(config, actor, input.teamId);
    const [view] = await this.db.insert(savedViews).values({
      organizationId: actor.organizationId, ownerId: actor.userId, teamId: input.teamId ?? null,
      name, visibility: input.visibility, config,
    }).returning();
    return { ...view, canEdit: true };
  }

  private async getVisibleView(id: string, actorId: string) {
    requireResourceId(id);
    const actor = await requireWorkspace(this.db, actorId);
    const [view] = await this.db.select().from(savedViews).where(and(
      eq(savedViews.id, id), eq(savedViews.organizationId, actor.organizationId),
      or(isNull(savedViews.teamId), inArray(savedViews.teamId, visibleTeamIds(this.db, actor))),
      or(eq(savedViews.visibility, 'shared'), eq(savedViews.ownerId, actor.userId)),
    ));
    if (!view) throw new NotFoundException('View not found');
    return { actor, view };
  }

  async update(id: string, actorId: string, input: { name?: string; visibility?: 'private' | 'shared'; config?: unknown }) {
    const { actor, view } = await this.getVisibleView(id, actorId);
    requireWrite(actor);
    if (view.teamId) await requireTeamWrite(this.db, actor, view.teamId);
    if (!await this.canManage(view, actor)) throw new ForbiddenException('View management permission required');
    const visibility = input.visibility ?? view.visibility as 'private' | 'shared';
    if (visibility === 'shared' && view.visibility !== 'shared') {
      if (view.teamId) {
        const [team] = await this.db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, view.teamId), teamManagerScope(this.db, actor)));
        if (!team) throw new ForbiddenException('Only team leads or workspace administrators can publish team views');
      } else requireAdmin(actor);
    }
    const name = input.name === undefined ? view.name : input.name.trim();
    if (!name) throw new BadRequestException('View name is required');
    const config = input.config === undefined ? view.config : this.validateConfig(input.config);
    await this.validateFilterAccess(config, actor, view.teamId ?? undefined);
    const [updated] = await this.db.update(savedViews).set({ name, visibility, config, updatedAt: new Date() })
      .where(eq(savedViews.id, id)).returning();
    return { ...updated, canEdit: true };
  }

  async delete(id: string, actorId: string) {
    const { actor, view } = await this.getVisibleView(id, actorId);
    requireWrite(actor);
    if (view.teamId) await requireTeamWrite(this.db, actor, view.teamId);
    if (!await this.canManage(view, actor)) throw new ForbiddenException('View management permission required');
    await this.db.delete(savedViews).where(eq(savedViews.id, id));
    return { success: true };
  }

  async addFavorite(actorId: string, resourceType: 'issue' | 'project' | 'view' | 'document', resourceId: string) {
    const actor = await requireWorkspace(this.db, actorId);
    requireWrite(actor);
    requireResourceId(resourceId);
    if (resourceType === 'issue') await requireIssue(this.db, actor, resourceId);
    else if (resourceType === 'project') await requireProject(this.db, actor, resourceId);
    else if (resourceType === 'document') await requireDocument(this.db, actor, resourceId);
    else await this.getVisibleView(resourceId, actorId);
    await this.db.insert(userFavorites).values({ organizationId: actor.organizationId, userId: actor.userId, resourceType, resourceId }).onConflictDoNothing();
    return { success: true };
  }

  async removeFavorite(actorId: string, resourceType: string, resourceId: string) {
    const actor = await requireWorkspace(this.db, actorId);
    requireWrite(actor);
    if (!['issue', 'project', 'view', 'document'].includes(resourceType)) throw new BadRequestException('Invalid favorite type');
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
        } else if (favorite.resourceType === 'view') {
          const { view } = await this.getVisibleView(favorite.resourceId, actorId);
          result.push({ resourceType: 'view', resourceId: view.id, name: view.name, href: `/issues?viewId=${view.id}` });
        }
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
        // Revoked or deleted resource: omit both its identifier and title.
      }
    }
    return result;
  }
}
