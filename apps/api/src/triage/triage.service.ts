import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { activities, issueTemplates, issues, teamWorkflowStates, type IssueTemplateField } from '@reka/database';
import { requireAdmin, requireResourceId, requireTeamManager, requireTeamWrite, requireWorkspace, issueScope, visibleTeamIds } from '../common/access/workspace-access';
import { DatabaseService } from '../common/database/database.service';
import { IssuesService } from '../issues/issues.service';
import { DEFAULT_TEAM_WORKFLOW_STATES } from '../teams/workflow-state-defaults';
import { CreateIssueTemplateDto, IssueTemplateFieldDto } from './dto/issue-template.dto';
import { UpdateIssueTemplateDto } from './dto/update-issue-template.dto';
import { SubmitIssueTemplateDto } from './dto/submit-issue-template.dto';
import { AcceptTriageIssueDto, DeclineTriageIssueDto, DuplicateTriageIssueDto } from './dto/triage-action.dto';

@Injectable()
export class TriageService {
  constructor(private readonly database: DatabaseService, private readonly issuesService: IssuesService) {}

  private templateScope(actor: Awaited<ReturnType<typeof requireWorkspace>>) {
    const db = this.database.db;
    return and(eq(issueTemplates.organizationId, actor.organizationId), or(
      isNull(issueTemplates.teamId), inArray(issueTemplates.teamId, visibleTeamIds(db, actor)),
    ));
  }

  private async requireTemplate(id: string, actorId: string, activeOnly = false) {
    requireResourceId(id);
    const actor = await requireWorkspace(this.database.db, actorId);
    const [template] = await this.database.db.select().from(issueTemplates).where(and(
      eq(issueTemplates.id, id), this.templateScope(actor), activeOnly ? eq(issueTemplates.isActive, true) : undefined,
    ));
    if (!template) throw new NotFoundException('Issue template not found');
    return { actor, template };
  }

  private async requireTemplateManager(actor: Awaited<ReturnType<typeof requireWorkspace>>, teamId: string | null) {
    if (teamId) await requireTeamManager(this.database.db, actor, teamId);
    else requireAdmin(actor);
  }

  private validateFields(fields: IssueTemplateFieldDto[] | IssueTemplateField[]) {
    if (!Array.isArray(fields) || fields.length > 20) throw new BadRequestException('A form can have at most 20 fields');
    const keys = new Set<string>();
    for (const field of fields) {
      if (!/^[a-z][a-z0-9_]{0,31}$/.test(field.key) || keys.has(field.key)) throw new BadRequestException('Form field keys must be unique and use lowercase letters, numbers and underscores');
      keys.add(field.key);
      if (!field.label?.trim() || field.label.length > 80 || !['text', 'textarea', 'select'].includes(field.type)) throw new BadRequestException('Invalid form field');
      if (field.type === 'select' && (!Array.isArray(field.options) || !field.options.length || field.options.length > 20 || field.options.some((option) => !option.trim() || option.length > 100))) {
        throw new BadRequestException(`Select field "${field.label}" needs 1–20 valid options`);
      }
      if (field.type !== 'select' && field.options?.length) throw new BadRequestException('Only select fields may define options');
    }
  }

  private async assertTriageStatus(teamId: string | null, status: string) {
    if (!teamId) {
      if (DEFAULT_TEAM_WORKFLOW_STATES.find((item) => item.key === status)?.category !== 'triage') throw new BadRequestException('Intake templates must start in a triage state');
      return;
    }
    const configured = await this.database.db.select({ key: teamWorkflowStates.key, category: teamWorkflowStates.category, isActive: teamWorkflowStates.isActive })
      .from(teamWorkflowStates).where(eq(teamWorkflowStates.teamId, teamId));
    const state = configured.find((item) => item.key === status);
    const category = state?.category ?? (!configured.length ? DEFAULT_TEAM_WORKFLOW_STATES.find((item) => item.key === status)?.category : undefined);
    if (category !== 'triage' || (configured.length > 0 && (!state || !state.isActive))) {
      throw new BadRequestException('Intake templates must start in an active triage state');
    }
  }

  async findTemplates(actorId: string, teamId?: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    if (teamId) await requireTeamWrite(this.database.db, actor, teamId);
    return this.database.db.select().from(issueTemplates).where(and(
      this.templateScope(actor), eq(issueTemplates.isActive, true),
      teamId ? or(isNull(issueTemplates.teamId), eq(issueTemplates.teamId, teamId)) : undefined,
    )).orderBy(asc(issueTemplates.name));
  }

  async createTemplate(dto: CreateIssueTemplateDto, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const teamId = dto.teamId ?? null;
    await this.requireTemplateManager(actor, teamId);
    this.validateFields(dto.fields ?? []);
    await this.assertTriageStatus(teamId, dto.defaultStatus ?? 'triage');
    const [created] = await this.database.db.insert(issueTemplates).values({
      organizationId: actor.organizationId, teamId, createdBy: actor.userId,
      name: dto.name.trim(), titlePrefix: dto.titlePrefix?.trim() ?? '', description: dto.description?.trim() || null,
      defaultStatus: dto.defaultStatus ?? 'triage', defaultType: dto.defaultType ?? 'task',
      defaultPriority: dto.defaultPriority ?? 'no_priority', defaultEstimate: dto.defaultEstimate ?? null,
      fields: dto.fields ?? [],
    }).returning();
    return created;
  }

  async updateTemplate(id: string, dto: UpdateIssueTemplateDto, actorId: string) {
    const { actor, template } = await this.requireTemplate(id, actorId);
    await this.requireTemplateManager(actor, template.teamId);
    if (dto.teamId !== undefined && dto.teamId !== template.teamId) {
      await this.requireTemplateManager(actor, dto.teamId ?? null);
      if (dto.teamId) await requireTeamManager(this.database.db, actor, dto.teamId);
    }
    if (dto.fields !== undefined) this.validateFields(dto.fields);
    const teamId = dto.teamId === undefined ? template.teamId : dto.teamId ?? null;
    await this.assertTriageStatus(teamId, dto.defaultStatus ?? template.defaultStatus);
    const [updated] = await this.database.db.update(issueTemplates).set({
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.teamId !== undefined ? { teamId: dto.teamId ?? null } : {}),
      ...(dto.titlePrefix !== undefined ? { titlePrefix: dto.titlePrefix.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      ...(dto.defaultStatus !== undefined ? { defaultStatus: dto.defaultStatus } : {}),
      ...(dto.defaultType !== undefined ? { defaultType: dto.defaultType } : {}),
      ...(dto.defaultPriority !== undefined ? { defaultPriority: dto.defaultPriority } : {}),
      ...(dto.defaultEstimate !== undefined ? { defaultEstimate: dto.defaultEstimate ?? null } : {}),
      ...(dto.fields !== undefined ? { fields: dto.fields } : {}), updatedAt: new Date(),
    }).where(and(eq(issueTemplates.id, template.id), this.templateScope(actor))).returning();
    if (!updated) throw new NotFoundException('Issue template not found');
    return updated;
  }

  async deleteTemplate(id: string, actorId: string) {
    const { actor, template } = await this.requireTemplate(id, actorId);
    await this.requireTemplateManager(actor, template.teamId);
    await this.database.db.delete(issueTemplates).where(and(eq(issueTemplates.id, template.id), this.templateScope(actor)));
    return { success: true };
  }

  async submitTemplate(id: string, dto: SubmitIssueTemplateDto, actorId: string) {
    const { actor, template } = await this.requireTemplate(id, actorId, true);
    const teamId = template.teamId ?? dto.teamId;
    if (!teamId || (template.teamId && dto.teamId && dto.teamId !== template.teamId)) throw new BadRequestException('Select a valid team for this intake form');
    await requireTeamWrite(this.database.db, actor, teamId);
    await this.assertTriageStatus(teamId, template.defaultStatus);
    const answers = dto.answers ?? {};
    const fields = template.fields;
    this.validateFields(fields);
    const knownKeys = new Set(fields.map((field) => field.key));
    if (Object.keys(answers).some((key) => !knownKeys.has(key))) throw new BadRequestException('Submission contains an unknown form field');
    const answerLines: string[] = [];
    for (const field of fields) {
      const raw = answers[field.key];
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (field.required && !value) throw new BadRequestException(`${field.label} is required`);
      if (!value) continue;
      if (value.length > (field.type === 'textarea' ? 4000 : 500)) throw new BadRequestException(`${field.label} is too long`);
      if (field.type === 'select' && !field.options?.includes(value)) throw new BadRequestException(`${field.label} has an invalid selection`);
      answerLines.push(`${field.label}:\n${value}`);
    }
    const title = [template.titlePrefix.trim(), dto.title.trim()].filter(Boolean).join(' ');
    if (!title || title.length > 255) throw new BadRequestException('The resulting issue title must be 1–255 characters');
    const description = [template.description?.trim(), ...answerLines].filter(Boolean).join('\n\n') || undefined;
    const issue = await this.issuesService.create({
      title, description, teamId, status: template.defaultStatus, type: template.defaultType,
      priority: template.defaultPriority, estimate: template.defaultEstimate, assigneeId: null,
    }, actorId);
    await this.database.db.insert(activities).values({
      actorId: actor.userId, issueId: issue.id, projectId: issue.projectId, type: 'issue.triage_submitted',
      metadata: { templateId: template.id, templateName: template.name },
    });
    return issue;
  }

  private async requireTriageIssue(id: string, actorId: string) {
    requireResourceId(id);
    const actor = await requireWorkspace(this.database.db, actorId);
    const [issue] = await this.database.db.select().from(issues).where(and(eq(issues.id, id), issueScope(this.database.db, actor), isNull(issues.archivedAt)));
    if (!issue) throw new NotFoundException('Issue not found');
    const [state] = await this.database.db.select({ category: teamWorkflowStates.category })
      .from(teamWorkflowStates).where(and(eq(teamWorkflowStates.teamId, issue.teamId), eq(teamWorkflowStates.key, issue.status)));
    const category = state?.category ?? DEFAULT_TEAM_WORKFLOW_STATES.find((item) => item.key === issue.status)?.category;
    if (category !== 'triage') throw new BadRequestException('Issue is not in triage');
    await requireTeamWrite(this.database.db, actor, issue.teamId);
    return { actor, issue };
  }

  async findTriage(actorId: string, teamId?: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    if (teamId) await requireTeamWrite(this.database.db, actor, teamId);
    const states = await this.database.db.select({ teamId: teamWorkflowStates.teamId, key: teamWorkflowStates.key, name: teamWorkflowStates.name })
      .from(teamWorkflowStates).where(eq(teamWorkflowStates.category, 'triage'));
    if (!states.length) return [];
    const visibleTeamIds = [...new Set(states.map((state) => state.teamId))];
    const clauses = states.filter((state) => !teamId || state.teamId === teamId).map((state) => and(eq(issues.teamId, state.teamId), eq(issues.status, state.key))!);
    if (!clauses.length) return [];
    const rows = await this.database.db.select().from(issues).where(and(
      issueScope(this.database.db, actor), isNull(issues.archivedAt), inArray(issues.teamId, visibleTeamIds), or(...clauses),
    )).orderBy(desc(issues.createdAt));
    const names = new Map(states.map((state) => [`${state.teamId}:${state.key}`, state.name]));
    return rows.map((issue) => ({ ...issue, statusLabel: names.get(`${issue.teamId}:${issue.status}`) ?? issue.status, statusCategory: 'triage' as const }));
  }

  async accept(id: string, dto: AcceptTriageIssueDto, actorId: string) {
    const { actor, issue } = await this.requireTriageIssue(id, actorId);
    const teamId = dto.teamId ?? issue.teamId;
    await requireTeamWrite(this.database.db, actor, teamId);
    const states = await this.database.db.select().from(teamWorkflowStates).where(and(eq(teamWorkflowStates.teamId, teamId), eq(teamWorkflowStates.isActive, true))).orderBy(asc(teamWorkflowStates.position));
    const defaults = DEFAULT_TEAM_WORKFLOW_STATES;
    const defaultStatus = states.length ? states.find((state) => ['unstarted', 'started', 'backlog'].includes(state.category))?.key : defaults.find((state) => state.category === 'unstarted')!.key;
    const status = dto.status ?? defaultStatus;
    if (!status) throw new BadRequestException('Configure an active work state before accepting triage issues');
    const targetCategory = states.find((state) => state.key === status)?.category ?? defaults.find((state) => state.key === status)?.category;
    if (!targetCategory || !['backlog', 'unstarted', 'started'].includes(targetCategory)) throw new BadRequestException('Accepted issues must route to an active work state');
    const updated = await this.issuesService.update(id, { ...dto, teamId, status }, actorId);
    await this.database.db.insert(activities).values({ actorId: actor.userId, issueId: id, projectId: updated.projectId,
      type: 'issue.triage_accepted', metadata: { fromTeamId: issue.teamId, toTeamId: updated.teamId, status: updated.status } });
    return updated;
  }

  async decline(id: string, dto: DeclineTriageIssueDto, actorId: string) {
    const { actor, issue } = await this.requireTriageIssue(id, actorId);
    const archived = await this.issuesService.archive(id, actorId);
    await this.database.db.insert(activities).values({ actorId: actor.userId, issueId: id, projectId: issue.projectId,
      type: 'issue.triage_declined', metadata: { reason: dto.reason?.trim() || null } });
    return archived;
  }

  async markDuplicate(id: string, dto: DuplicateTriageIssueDto, actorId: string) {
    const { actor, issue } = await this.requireTriageIssue(id, actorId);
    await this.issuesService.addRelation(id, { relatedIssueId: dto.relatedIssueId, type: 'duplicate' }, actorId);
    const archived = await this.issuesService.archive(id, actorId);
    await this.database.db.insert(activities).values({ actorId: actor.userId, issueId: id, projectId: issue.projectId,
      type: 'issue.triage_duplicate', metadata: { relatedIssueId: dto.relatedIssueId, reason: dto.reason?.trim() || null } });
    return archived;
  }
}
