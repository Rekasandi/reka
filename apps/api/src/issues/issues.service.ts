import { Injectable, NotFoundException, BadRequestException, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../common/database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { issues, issueLabels, issueRelations, labels, activities, githubRepositories, projectRepositories, teams, teamWorkflowStates, issueRecurrences, issueRecurrenceRuns, milestones } from '@reka/database';
import { and, desc, eq, inArray, isNull, isNotNull, or, sql } from 'drizzle-orm';
import { requireWorkspace, requireTeam, requireTeamWrite, requireIssue, requireIssueWrite, requireProject, requireCycle, requireEligibleUser, requireResourceId, issueScope, labelScope, repositoryScope, type WorkspaceActor } from '../common/access/workspace-access';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { UpdateIssuesBulkDto } from './dto/update-issues-bulk.dto';
import { CreateIssueRelationDto } from './dto/create-issue-relation.dto';
import { GITHUB_USER_TOKENS } from '../auth/auth.service';
import { getIssueNotificationRecipients } from './issue-notification-recipients';
import { IssueSubscriptionsService } from '../issue-subscriptions/issue-subscriptions.service';
import { DEFAULT_TEAM_WORKFLOW_STATES } from '../teams/workflow-state-defaults';
import { ConfigureIssueRecurrenceDto } from './dto/issue-recurrence.dto';
import type { RecurringIssueTemplate } from '@reka/database';

@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly issueSubscriptions?: IssueSubscriptionsService,
  ) {}

  async findAll(actorId: string, status?: string, archived = false) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const issueRows = await this.database.db.select().from(issues)
      .where(and(issueScope(this.database.db, actor), archived ? isNotNull(issues.archivedAt) : isNull(issues.archivedAt), status ? eq(issues.status, status) : undefined))
      .orderBy(desc(issues.sortOrder), desc(issues.createdAt));
    if (!issueRows.length) return issueRows;

    const workflowRows = await this.database.db.select().from(teamWorkflowStates).where(inArray(teamWorkflowStates.teamId, [...new Set(issueRows.map((issue) => issue.teamId))]));
    const workflowByTeam = new Map(workflowRows.map((state) => [`${state.teamId}:${state.key}`, state]));
    const labelRows = await this.database.db
      .select({ issueId: issueLabels.issueId, id: labels.id, name: labels.name, color: labels.color })
      .from(issueLabels)
      .innerJoin(labels, eq(issueLabels.labelId, labels.id))
      .where(and(inArray(issueLabels.issueId, issueRows.map((issue) => issue.id)), labelScope(this.database.db, actor)));
    const labelsByIssue = new Map<string, { id: string; name: string; color: string }[]>();
    for (const { issueId, ...label } of labelRows) {
      const list = labelsByIssue.get(issueId) ?? [];
      list.push(label);
      labelsByIssue.set(issueId, list);
    }

    return issueRows.map((issue) => {
      const configured = workflowByTeam.get(`${issue.teamId}:${issue.status}`);
      const fallback = DEFAULT_TEAM_WORKFLOW_STATES.find((state) => state.key === issue.status);
      return { ...issue, statusLabel: configured?.name ?? fallback?.name ?? issue.status.replaceAll('_', ' '),
        statusCategory: configured?.category ?? fallback?.category ?? 'started', statusPosition: configured?.position ?? fallback?.position ?? 99,
        labels: labelsByIssue.get(issue.id) ?? [] };
    });
  }

  private async validateStatus(teamId: string, status: string) {
    const configuredStates = await this.database.db.select({ key: teamWorkflowStates.key, isActive: teamWorkflowStates.isActive })
      .from(teamWorkflowStates).where(eq(teamWorkflowStates.teamId, teamId));
    if (configuredStates.length) {
      if (configuredStates.some((state) => state.key === status && state.isActive)) return;
      throw new BadRequestException('Status is not active in this team workflow');
    }
    if (!DEFAULT_TEAM_WORKFLOW_STATES.some((state) => state.key === status)) throw new BadRequestException('Status is not active in this team workflow');
  }

  private async validateLabelIds(actor: WorkspaceActor, labelIds: string[] | undefined, teamId: string, projectId?: string | null) {
    if (labelIds === undefined || labelIds.length === 0) return;
    const projectFilter = projectId
      ? or(isNull(labels.projectId), eq(labels.projectId, projectId))
      : isNull(labels.projectId);
    const eligible = await this.database.db.select({ id: labels.id }).from(labels).where(and(
      inArray(labels.id, labelIds), labelScope(this.database.db, actor),
      or(isNull(labels.teamId), eq(labels.teamId, teamId)), projectFilter,
    ));
    if (eligible.length !== labelIds.length) throw new BadRequestException('Every label must be visible and eligible for this issue team and project');
  }

  private async replaceLabels(issueId: string, labelIds: string[] | undefined) {
    if (labelIds === undefined) return;
    await this.database.db.delete(issueLabels).where(eq(issueLabels.issueId, issueId));
    if (labelIds.length) await this.database.db.insert(issueLabels).values(labelIds.map((labelId) => ({ issueId, labelId })));
  }

  async findById(id: string, actorId: string) {
    return requireIssue(this.database.db, await requireWorkspace(this.database.db, actorId), id);
  }

  async findByIdentifier(identifier: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const result = await this.database.db
      .select()
      .from(issues)
      .where(and(eq(issues.identifier, identifier.toUpperCase()), issueScope(this.database.db, actor)));
    if (!result.length) {
      throw new NotFoundException(`Issue ${identifier} not found`);
    }
    return result[0];
  }

  private async validateRelations(actor: WorkspaceActor, teamId: string, projectId?: string | null, cycleId?: string | null, parentId?: string | null, editingId?: string, milestoneId?: string | null) {
    await requireTeam(this.database.db, actor, teamId);
    const visited = new Set(editingId ? [editingId] : []);
    let cursor = parentId;
    while (cursor) {
      if (visited.has(cursor)) throw new BadRequestException('Issue hierarchy cannot contain a cycle');
      visited.add(cursor);
      const parent = await requireIssue(this.database.db, actor, cursor);
      if (parent.archivedAt) throw new BadRequestException('Restore the parent issue before creating or moving sub-issues');
      if (parent.teamId !== teamId) throw new BadRequestException('Parent must belong to issue team');
      cursor = parent.parentId;
    }
    if (projectId) {
      const project = await requireProject(this.database.db, actor, projectId);
      if (project.teamId !== teamId) throw new BadRequestException('Project must belong to issue team');
    }
    if (cycleId) {
      const cycle = await requireCycle(this.database.db, actor, cycleId);
      if (cycle.teamId !== teamId) throw new BadRequestException('Cycle must belong to issue team');
    }
    if (milestoneId) {
      if (!projectId) throw new BadRequestException('Milestones require an issue project');
      requireResourceId(milestoneId);
      const [milestone] = await this.database.db.select().from(milestones).where(eq(milestones.id, milestoneId));
      if (!milestone || milestone.projectId !== projectId) throw new BadRequestException('Milestone must belong to the issue project');
      await requireProject(this.database.db, actor, milestone.projectId);
    }
  }

  async create(dto: CreateIssueDto, actorId: string) {
    // Team owns every issue; no implicit fallback.
    const actor = await requireWorkspace(this.database.db, actorId);
    const teamId = dto.teamId;
    const team = await requireTeamWrite(this.database.db, actor, teamId);
    const teamKey = team.key;
    await this.validateRelations(actor, teamId, dto.projectId, dto.cycleId, dto.parentId, undefined, dto.milestoneId);
    await this.validateStatus(teamId, dto.status ?? 'todo');
    if (dto.assigneeId) await requireEligibleUser(this.database.db, actor, dto.assigneeId, teamId);
    await this.validateLabelIds(actor, dto.labelIds, teamId, dto.projectId);

    const reporterId = actorId;

    // The team counter allocates a unique identifier atomically across concurrent creators.
    const [counter] = await this.database.db.update(teams)
      .set({ issueCounter: sql`GREATEST(${teams.issueCounter}, (SELECT COALESCE(MAX(number), 0) FROM issues WHERE team_id = ${teams.id})) + 1` })
      .where(and(eq(teams.id, teamId), eq(teams.organizationId, actor.organizationId)))
      .returning({ value: teams.issueCounter });
    if (!counter) throw new NotFoundException('Team not found');
    const nextNumber = counter.value;
    const identifier = `${teamKey}-${nextNumber}`;

    // 4. Create Issue in REKA Database
    const [created] = await this.database.db
      .insert(issues)
      .values({
        identifier,
        number: nextNumber,
        title: dto.title.trim(),
        description: dto.description || null,
        status: dto.status || 'todo',
        priority: dto.priority || 'no_priority',
        type: dto.type || 'task',
        teamId,
        projectId: dto.projectId || null,
        parentId: dto.parentId || null,
        cycleId: dto.cycleId || null,
        milestoneId: dto.milestoneId || null,
        assigneeId: dto.assigneeId === null ? null : dto.assigneeId || reporterId,
        estimate: dto.estimate ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        reporterId,
      })
      .returning();
    await this.replaceLabels(created.id, dto.labelIds);

    // 5. Automatic Linear-style GitHub Issue Creation (Sync)
    void this.syncToGithub(created, reporterId);

    // 6. Record activity
    await this.database.db.insert(activities).values({
      actorId: reporterId,
      issueId: created.id,
      projectId: created.projectId,
      type: 'issue.created',
      metadata: { identifier, title: created.title },
    });

    // 7. Notify the real assignee, not the actor.
    for (const userId of getIssueNotificationRecipients(created.assigneeId, null, reporterId)) {
      try {
        await this.notificationsService.createForEvent(userId, {
          type: 'assignment',
          title: `Assigned to ${created.identifier}`,
          body: `You were assigned to ${created.title} (${created.identifier})`,
          link: `/issues`,
          metadata: {
            issueId: created.id,
            issueIdentifier: created.identifier,
            priority: created.priority,
          },
        });
      } catch {
        // Non-fatal
      }
    }

    return created;
  }

  private async syncToGithub(issue: typeof issues.$inferSelect, userId: string) {
    try {
      // Never send a private issue to the first global repository or use
      // another employee's cached OAuth token. Only explicitly linked repos.
      if (!issue.projectId) return;
      const actor = await requireWorkspace(this.database.db, userId);
      const current = await requireIssueWrite(this.database.db, actor, issue.id);
      if (current.projectId !== issue.projectId) return;
      const [linked] = await this.database.db.select({ repo: githubRepositories })
        .from(projectRepositories)
        .innerJoin(githubRepositories, eq(projectRepositories.repositoryId, githubRepositories.id))
        .where(and(eq(projectRepositories.projectId, issue.projectId), repositoryScope(this.database.db, actor))).limit(1);
      if (!linked) return;
      const repo = linked.repo;
      const token = GITHUB_USER_TOKENS.get(userId) || process.env.GITHUB_TOKEN;

      if (!token) {
        this.logger.warn('No active GitHub OAuth token available. Re-login via GitHub or set GITHUB_TOKEN in .env to enable auto-sync.');
        return;
      }

      const bodyText = `
**[${issue.identifier}]** ${issue.title}

${issue.description || 'No description provided.'}

---
*Created automatically from REKA Workspace*
- **Type**: ${issue.type}
- **Priority**: ${issue.priority}
- **Status**: ${issue.status}
      `.trim();

      const res = await fetch(`https://api.github.com/repos/${repo.fullName}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'REKA-Platform-App',
        },
        body: JSON.stringify({
          title: `[${issue.identifier}] ${issue.title}`,
          body: bodyText,
        }),
      });

      if (res.ok) {
        const ghIssue = (await res.json()) as any;
        await this.database.db
          .update(issues)
          .set({
            githubIssueNumber: ghIssue.number,
            githubIssueUrl: ghIssue.html_url,
          })
          .where(eq(issues.id, issue.id));

        await this.database.db.insert(activities).values({
          issueId: issue.id,
          type: 'github.issue_created',
          metadata: {
            githubIssueNumber: ghIssue.number,
            githubIssueUrl: ghIssue.html_url,
          },
        });

        this.logger.log(`✅ Synced issue ${issue.identifier} to GitHub Issue #${ghIssue.number} in ${repo.fullName}`);
      } else {
        const errJson = await res.json().catch(() => null);
        this.logger.error(`GitHub API responded with ${res.status}: ${JSON.stringify(errJson)}`);
      }
    } catch (err) {
      this.logger.error('Failed to sync issue to GitHub Issues:', err);
    }
  }

  async findSubtasks(parentId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireIssue(this.database.db, actor, parentId);
    const rows = await this.database.db.select().from(issues)
      .where(and(eq(issues.parentId, parentId), issueScope(this.database.db, actor), isNull(issues.archivedAt)))
      .orderBy(desc(issues.createdAt));
    if (!rows.length) return rows;
    const states = await this.database.db.select().from(teamWorkflowStates).where(eq(teamWorkflowStates.teamId, rows[0].teamId));
    return rows.map((issue) => {
      const configured = states.find((state) => state.key === issue.status);
      const fallback = DEFAULT_TEAM_WORKFLOW_STATES.find((state) => state.key === issue.status);
      return { ...issue, statusLabel: configured?.name ?? fallback?.name ?? issue.status.replaceAll('_', ' '),
        statusCategory: configured?.category ?? fallback?.category ?? 'started', statusPosition: configured?.position ?? fallback?.position ?? 99 };
    });
  }

  async update(id: string, dto: UpdateIssueDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const existing = await requireIssueWrite(this.database.db, actor, id);
    if (existing.archivedAt) throw new BadRequestException('Restore the archived issue before editing it');
    const targetTeamId = dto.teamId ?? existing.teamId;
    if (dto.status !== undefined || targetTeamId !== existing.teamId) await this.validateStatus(targetTeamId, dto.status ?? existing.status);
    await this.validateRelations(actor, targetTeamId,
      dto.projectId !== undefined ? dto.projectId : existing.projectId,
      dto.cycleId !== undefined ? dto.cycleId : existing.cycleId,
      dto.parentId !== undefined ? dto.parentId : existing.parentId, id,
      dto.milestoneId !== undefined ? dto.milestoneId : existing.milestoneId);
    await requireTeamWrite(this.database.db, actor, targetTeamId);
    if (dto.assigneeId) await requireEligibleUser(this.database.db, actor, dto.assigneeId, targetTeamId);
    const targetProjectId = dto.projectId !== undefined ? dto.projectId : existing.projectId;
    await this.validateLabelIds(actor, dto.labelIds, targetTeamId, targetProjectId);
    if (targetTeamId !== existing.teamId) {
      const targetAssignee = dto.assigneeId !== undefined ? dto.assigneeId : existing.assigneeId;
      if (targetAssignee) await requireEligibleUser(this.database.db, actor, targetAssignee, targetTeamId);
      const [child] = await this.database.db.select({ id: issues.id }).from(issues).where(eq(issues.parentId, id)).limit(1);
      if (child) throw new BadRequestException('Move sub-issues to the target team together with their parent');
    }

    const { labelIds, dueDate, title, ...issueChanges } = dto;
    if (title !== undefined && !title.trim()) throw new BadRequestException('Issue title cannot be blank');
    const [updated] = await this.database.db
      .update(issues)
      .set({
        ...issueChanges,
        title: title === undefined ? undefined : title.trim(),
        dueDate: dueDate === undefined ? undefined : dueDate === null ? null : new Date(dueDate),
        updatedAt: new Date(),
      })
      .where(and(eq(issues.id, id), issueScope(this.database.db, actor)))
      .returning();
    if (!updated) throw new NotFoundException('Issue not found');
    await this.replaceLabels(id, labelIds);

    // Record activity if status changed
    if (dto.status && dto.status !== existing.status) {
      await this.database.db.insert(activities).values({
        issueId: id,
        projectId: updated.projectId,
        actorId,
        type: 'issue.status_changed',
        metadata: {
          from: existing.status,
          to: dto.status,
          identifier: updated.identifier,
        },
      });

      // Notify assignee / reporter if status changed
      const subscribers = await this.issueSubscriptions?.getSubscriberIds(id) ?? [];
      const notifyUserIds = getIssueNotificationRecipients(updated.assigneeId, updated.reporterId, actorId, subscribers);
      for (const notifyUserId of notifyUserIds) {
        try {
          await this.notificationsService.createForEvent(notifyUserId, {
            type: 'status_change',
            title: `${updated.identifier} moved to ${dto.status.replace('_', ' ')}`,
            body: `Status of "${updated.title}" changed from ${existing.status} to ${dto.status}.`,
            link: `/issues`,
            metadata: {
              issueId: updated.id,
              issueIdentifier: updated.identifier,
              fromStatus: existing.status,
              toStatus: dto.status,
            },
          });
        } catch {
          // Non-fatal
        }
      }
    }

    // Notify if assignee changed
    if (dto.assigneeId && dto.assigneeId !== existing.assigneeId) {
      const subscribers = await this.issueSubscriptions?.getSubscriberIds(id) ?? [];
      for (const userId of getIssueNotificationRecipients(dto.assigneeId, null, actorId, subscribers)) {
        try {
          await this.notificationsService.createForEvent(userId, {
            type: 'assignment',
            title: `Assigned to ${updated.identifier}`,
            body: `You were assigned to ${updated.title} (${updated.identifier})`,
            link: `/issues`,
            metadata: {
              issueId: updated.id,
              issueIdentifier: updated.identifier,
              priority: updated.priority,
            },
          });
        } catch {
          // Non-fatal
        }
      }
    }

    return updated;
  }

  async updateMany(dto: UpdateIssuesBulkDto, actorId: string) {
    const { ids, ...rawChanges } = dto;
    const changes = Object.fromEntries(Object.entries(rawChanges).filter(([, value]) => value !== undefined));
    if (!Object.keys(changes).length) throw new BadRequestException('At least one issue property must be changed');
    const actor = await requireWorkspace(this.database.db, actorId);
    const current = await this.database.db.select().from(issues).where(and(
      inArray(issues.id, ids), issueScope(this.database.db, actor), isNull(issues.archivedAt),
    ));
    if (current.length !== ids.length) throw new NotFoundException('One or more issues are not available');
    for (const teamId of new Set(current.map((issue) => issue.teamId))) {
      await requireTeamWrite(this.database.db, actor, teamId);
      if (dto.status) await this.validateStatus(teamId, dto.status);
    }
    const updated = await this.database.db.update(issues).set({
      ...(changes as any),
      dueDate: dto.dueDate === undefined ? undefined : dto.dueDate === null ? null : new Date(dto.dueDate),
      updatedAt: new Date(),
    }).where(and(inArray(issues.id, ids), issueScope(this.database.db, actor), isNull(issues.archivedAt))).returning();
    if (updated.length !== ids.length) throw new NotFoundException('One or more issues are no longer available');
    const statusChanges = updated.flatMap((issue) => {
      const before = current.find((item) => item.id === issue.id)!;
      return dto.status && dto.status !== before.status ? [{ issue, before }] : [];
    });
    if (statusChanges.length) await this.database.db.insert(activities).values(statusChanges.map(({ issue, before }) => ({
      actorId, issueId: issue.id, projectId: issue.projectId, type: 'issue.status_changed',
      metadata: { from: before.status, to: issue.status, identifier: issue.identifier },
    })));
    for (const { issue, before } of statusChanges) {
      const subscribers = await this.issueSubscriptions?.getSubscriberIds(issue.id) ?? [];
      for (const userId of getIssueNotificationRecipients(issue.assigneeId, issue.reporterId, actorId, subscribers)) {
        try {
          await this.notificationsService.createForEvent(userId, {
            type: 'status_change', title: `${issue.identifier} moved to ${issue.status.replace('_', ' ')}`,
            body: `Status of "${issue.title}" changed from ${before.status} to ${issue.status}.`, link: '/issues',
            metadata: { issueId: issue.id, issueIdentifier: issue.identifier, fromStatus: before.status, toStatus: issue.status },
          });
        } catch { /* Notifications are best-effort after the atomic issue update. */ }
      }
    }
    return updated;
  }

  async moveToTop(id: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const issue = await requireIssueWrite(this.database.db, actor, id);
    if (issue.archivedAt) throw new BadRequestException('Restore the issue before reordering it');
    const [updated] = await this.database.db.update(issues).set({
      sortOrder: sql`(SELECT COALESCE(MAX(sort_order), 0) + 1 FROM issues WHERE team_id = ${issue.teamId} AND archived_at IS NULL)`,
      updatedAt: new Date(),
    }).where(and(eq(issues.id, id), issueScope(this.database.db, actor), isNull(issues.archivedAt))).returning();
    return updated;
  }

  private async issueSubtreeIds(teamId: string, rootId: string, actor: WorkspaceActor) {
    const rows = await this.database.db.select({ id: issues.id, parentId: issues.parentId }).from(issues)
      .where(and(eq(issues.teamId, teamId), issueScope(this.database.db, actor)));
    const children = new Map<string, string[]>();
    for (const row of rows) if (row.parentId) children.set(row.parentId, [...(children.get(row.parentId) ?? []), row.id]);
    const result: string[] = [];
    const pending = [rootId];
    while (pending.length) {
      const next = pending.pop()!;
      if (result.includes(next)) continue;
      result.push(next);
      pending.push(...(children.get(next) ?? []));
    }
    return result;
  }

  async getRecurrence(id: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireIssue(this.database.db, actor, id);
    const [recurrence] = await this.database.db.select().from(issueRecurrences).where(eq(issueRecurrences.sourceIssueId, id)).limit(1);
    if (!recurrence) return null;
    const recentRuns = await this.database.db.select().from(issueRecurrenceRuns).where(eq(issueRecurrenceRuns.recurrenceId, recurrence.id))
      .orderBy(desc(issueRecurrenceRuns.scheduledFor)).limit(10);
    return { ...recurrence, recentRuns };
  }

  async configureRecurrence(id: string, dto: ConfigureIssueRecurrenceDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const issue = await requireIssueWrite(this.database.db, actor, id);
    if (issue.archivedAt) throw new BadRequestException('Restore the issue before configuring recurrence');
    try { new Intl.DateTimeFormat('en-US', { timeZone: dto.timezone }).format(new Date()); }
    catch { throw new BadRequestException('Timezone must be a valid IANA timezone'); }
    const nextRunAt = new Date(dto.nextRunAt);
    if (nextRunAt.getTime() <= Date.now()) throw new BadRequestException('Next occurrence must be in the future');
    await this.validateStatus(issue.teamId, issue.status);
    const assignedLabels = await this.database.db.select({ id: issueLabels.labelId }).from(issueLabels).where(eq(issueLabels.issueId, id));
    const template: RecurringIssueTemplate = {
      title: issue.title, description: issue.description, status: issue.status, priority: issue.priority, type: issue.type,
      projectId: issue.projectId, cycleId: issue.cycleId, assigneeId: issue.assigneeId, parentId: issue.parentId,
      estimate: issue.estimate, labelIds: assignedLabels.map((label) => label.id), dueDateOffsetDays: dto.dueDateOffsetDays ?? null,
    };
    await this.database.db.insert(issueRecurrences).values({
      sourceIssueId: issue.id, teamId: issue.teamId, createdBy: actor.userId, intervalCount: dto.intervalCount,
      unit: dto.unit, timezone: dto.timezone, nextRunAt, enabled: true, template,
    }).onConflictDoUpdate({
      target: issueRecurrences.sourceIssueId,
      set: { intervalCount: dto.intervalCount, unit: dto.unit, timezone: dto.timezone, nextRunAt, enabled: true, template, updatedAt: new Date() },
    });
    return this.getRecurrence(id, actorId);
  }

  async stopRecurrence(id: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireIssueWrite(this.database.db, actor, id);
    await this.database.db.update(issueRecurrences).set({ enabled: false, updatedAt: new Date() })
      .where(eq(issueRecurrences.sourceIssueId, id));
    return { success: true };
  }

  async archive(id: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const issue = await requireIssueWrite(this.database.db, actor, id);
    if (issue.archivedAt) return issue;
    const subtree = await this.issueSubtreeIds(issue.teamId, id, actor);
    const archivedAt = new Date();
    const archiveBatchId = randomUUID();
    const updated = await this.database.db.update(issues).set({ archivedAt, archiveBatchId, updatedAt: archivedAt })
      .where(and(inArray(issues.id, subtree), issueScope(this.database.db, actor), isNull(issues.archivedAt)))
      .returning({ id: issues.id });
    await this.database.db.update(issueRecurrences).set({ enabled: false, updatedAt: archivedAt })
      .where(and(inArray(issueRecurrences.sourceIssueId, subtree), eq(issueRecurrences.enabled, true)));
    await this.database.db.insert(activities).values({
      actorId, issueId: id, projectId: issue.projectId, type: 'issue.archived',
      metadata: { identifier: issue.identifier, archivedSubIssueCount: Math.max(0, updated.length - 1) },
    });
    return this.database.db.select().from(issues).where(eq(issues.id, id)).then((rows) => rows[0]);
  }

  async restore(id: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const issue = await requireIssueWrite(this.database.db, actor, id);
    if (!issue.archivedAt) return issue;
    const subtree = issue.archiveBatchId ? await this.issueSubtreeIds(issue.teamId, id, actor) : [id];
    const restoredAt = new Date();
    const batchScope = issue.archiveBatchId ? eq(issues.archiveBatchId, issue.archiveBatchId) : eq(issues.id, id);
    const restored = await this.database.db.update(issues).set({ archivedAt: null, archiveBatchId: null, updatedAt: restoredAt })
      .where(and(inArray(issues.id, subtree), batchScope, isNotNull(issues.archivedAt), issueScope(this.database.db, actor)))
      .returning({ id: issues.id });
    await this.database.db.insert(activities).values({
      actorId, issueId: id, projectId: issue.projectId, type: 'issue.restored',
      metadata: { identifier: issue.identifier, restoredSubIssueCount: Math.max(0, restored.length - 1) },
    });
    return this.database.db.select().from(issues).where(eq(issues.id, id)).then((rows) => rows[0]);
  }

  private normalizeRelation(issueId: string, relatedIssueId: string, type: CreateIssueRelationDto['type']) {
    if (type === 'blocks') return { issueId, relatedIssueId, type };
    if (type === 'blocked_by') return { issueId: relatedIssueId, relatedIssueId: issueId, type: 'blocks' as const };
    const pair = issueId < relatedIssueId ? { issueId, relatedIssueId } : { issueId: relatedIssueId, relatedIssueId: issueId };
    return type === 'duplicate' ? { ...pair, type, duplicateSourceIssueId: issueId } : { ...pair, type };
  }

  async findRelations(issueId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    await requireIssue(this.database.db, actor, issueId);
    const rows = await this.database.db.select().from(issueRelations).where(or(
      eq(issueRelations.issueId, issueId), eq(issueRelations.relatedIssueId, issueId),
    ));
    const result = [];
    for (const row of rows) {
      const relatedId = row.issueId === issueId ? row.relatedIssueId : row.issueId;
      try {
        const relatedIssue = await requireIssue(this.database.db, actor, relatedId);
        const type = row.type === 'blocks' && row.issueId !== issueId ? 'blocked_by' : row.type;
        result.push({ type, relatedIssue, duplicateDirection: row.type === 'duplicate' ? (row.duplicateSourceIssueId ? (row.duplicateSourceIssueId === issueId ? 'source' : 'target') : 'unknown') : undefined,
          duplicateSourceIssueId: row.duplicateSourceIssueId });
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    return result;
  }

  async addRelation(issueId: string, dto: CreateIssueRelationDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const issue = await requireIssueWrite(this.database.db, actor, issueId);
    const related = await requireIssueWrite(this.database.db, actor, dto.relatedIssueId);
    if (issue.archivedAt || related.archivedAt) throw new BadRequestException('Restore archived issues before changing relations');
    if (issueId === dto.relatedIssueId) throw new BadRequestException('An issue cannot be related to itself');
    if (issue.teamId !== related.teamId) throw new BadRequestException('Issue relations must stay within the same team');
    const relation = this.normalizeRelation(issueId, dto.relatedIssueId, dto.type);
    if (relation.type === 'blocks') {
      const teamIssueIds = await this.database.db.select({ id: issues.id }).from(issues).where(eq(issues.teamId, issue.teamId));
      const edges = await this.database.db.select({ from: issueRelations.issueId, to: issueRelations.relatedIssueId })
        .from(issueRelations).where(and(eq(issueRelations.type, 'blocks'),
          inArray(issueRelations.issueId, teamIssueIds.map((row) => row.id)),
          inArray(issueRelations.relatedIssueId, teamIssueIds.map((row) => row.id))));
      const graph = new Map<string, string[]>();
      for (const edge of edges) graph.set(edge.from, [...(graph.get(edge.from) ?? []), edge.to]);
      const pending = [relation.relatedIssueId];
      const visited = new Set<string>();
      while (pending.length) {
        const current = pending.pop()!;
        if (current === relation.issueId) throw new BadRequestException('Blocking relations cannot contain a cycle');
        if (visited.has(current)) continue;
        visited.add(current);
        pending.push(...(graph.get(current) ?? []));
      }
    }
    const [created] = await this.database.db.insert(issueRelations).values(relation).onConflictDoNothing().returning();
    if (created) await this.database.db.insert(activities).values({
      actorId, issueId, projectId: issue.projectId, type: 'issue.relation_added',
      metadata: { type: dto.type, relatedIssueIdentifier: related.identifier },
    });
    const [persistedRelation] = created ? [created] : await this.database.db.select().from(issueRelations).where(and(
      eq(issueRelations.issueId, relation.issueId), eq(issueRelations.relatedIssueId, relation.relatedIssueId), eq(issueRelations.type, relation.type),
    )).limit(1);
    return { type: dto.type, relatedIssue: related, duplicateSourceIssueId: persistedRelation?.duplicateSourceIssueId ?? null };
  }

  async removeRelation(issueId: string, relatedIssueId: string, type: string, actorId: string) {
    if (!['blocks', 'blocked_by', 'related_to', 'duplicate'].includes(type)) throw new BadRequestException('Invalid issue relation type');
    const actor = await requireWorkspace(this.database.db, actorId);
    const issue = await requireIssueWrite(this.database.db, actor, issueId);
    await requireIssueWrite(this.database.db, actor, relatedIssueId);
    if (issueId === relatedIssueId) throw new BadRequestException('An issue cannot be related to itself');
    const relation = this.normalizeRelation(issueId, relatedIssueId, type as CreateIssueRelationDto['type']);
    const removed = await this.database.db.delete(issueRelations).where(and(
      eq(issueRelations.issueId, relation.issueId), eq(issueRelations.relatedIssueId, relation.relatedIssueId), eq(issueRelations.type, relation.type),
    )).returning({ issueId: issueRelations.issueId });
    if (!removed.length) throw new NotFoundException('Issue relation not found');
    await this.database.db.insert(activities).values({ actorId, issueId, projectId: issue.projectId, type: 'issue.relation_removed', metadata: { type, relatedIssueId } });
    return { success: true };
  }

  async delete(id: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const issue = await requireIssueWrite(this.database.db, actor, id);
    const subtree = await this.issueSubtreeIds(issue.teamId, id, actor);
    const deleted = await this.database.db.delete(issues).where(and(inArray(issues.id, subtree), issueScope(this.database.db, actor))).returning({ id: issues.id });
    if (!deleted.length) throw new NotFoundException('Issue not found');
    return { success: true, deletedIssueCount: deleted.length };
  }
}
