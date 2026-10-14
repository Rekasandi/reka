import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../common/database/database.service';
import { teams, users, teamMembers, issues, cycles, organizationMembers, teamWorkflowStates, issueRecurrences, issueTemplates } from '@reka/database';
import { requireWorkspace, requireAdmin, requireWrite, requireTeam, requireTeamManager, requireEligibleUser, teamScope, teamManagerScope, issueScope, userScope, visibleTeamIds, membershipScope, requireResourceId, type WorkspaceActor } from '../common/access/workspace-access';
import { eq, desc, and, inArray, sql, asc, notInArray } from 'drizzle-orm';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto, UpdateTeamMemberDto } from './dto/team.dto';
import { UpdateTeamWorkflowStatesDto } from './dto/workflow-state.dto';
import { DEFAULT_TEAM_WORKFLOW_STATES } from './workflow-state-defaults';

@Injectable()
export class TeamsService {
  constructor(private readonly database: DatabaseService, private readonly notificationsService: NotificationsService) {}

  private capabilities(team: { isPrivate: boolean }, actor: WorkspaceActor, members: { userId: string; role: string }[]) {
    const current = members.find(member => member.userId === actor.userId);
    const writable = ['owner', 'admin', 'member'].includes(actor.role);
    return { currentMemberUserId: actor.userId, currentMemberRole: current?.role ?? null,
      canManage: writable && (actor.role === 'owner' || actor.role === 'admin' || current?.role === 'lead'),
      canWrite: writable && current?.role !== 'viewer',
      canDelete: actor.role === 'owner' || actor.role === 'admin',
      canJoin: writable && !team.isPrivate && !current,
      canLeave: writable && !!current,
    };
  }

  async findAll(actorId: string) {
    const db = this.database.db, actor = await requireWorkspace(db, actorId);
    const teamList = await db.select().from(teams).where(teamScope(db, actor)).orderBy(desc(teams.createdAt));
    const allMembers = await db.select().from(teamMembers).where(and(inArray(teamMembers.teamId, visibleTeamIds(db, actor)),
      inArray(teamMembers.userId, db.select({ id: users.id }).from(users).where(userScope(db, actor)))));
    const allUsers = await db.select().from(users).where(userScope(db, actor));
    const teamIssues = await db.select({ teamId: issues.teamId }).from(issues).where(issueScope(db, actor));
    return teamList.map(team => {
      const members = allMembers.filter(member => member.teamId === team.id).map(member => ({ ...member, user: allUsers.find(user => user.id === member.userId) }));
      return { ...team, ...this.capabilities(team, actor, members), members, memberCount: members.length, issueCount: teamIssues.filter(issue => issue.teamId === team.id).length };
    });
  }

  async findById(id: string, actorId: string) {
    const db = this.database.db, actor = await requireWorkspace(db, actorId);
    const team = await requireTeam(db, actor, id);
    const rawMembers = await db.select().from(teamMembers).where(and(eq(teamMembers.teamId, id), inArray(teamMembers.teamId, visibleTeamIds(db, actor)),
      inArray(teamMembers.userId, db.select({ id: users.id }).from(users).where(userScope(db, actor)))));
    const allUsers = await db.select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl, role: organizationMembers.role })
      .from(users).innerJoin(organizationMembers, and(eq(organizationMembers.userId, users.id), eq(organizationMembers.organizationId, actor.organizationId)))
      .where(and(eq(organizationMembers.isActive, true), membershipScope(db, actor)));
    const assigned = await db.select().from(issues).where(and(eq(issues.teamId, id), issueScope(db, actor)));
    const teamCycles = await db.select().from(cycles).where(and(eq(cycles.teamId, id), inArray(cycles.teamId, visibleTeamIds(db, actor))));
    const members = rawMembers.map(member => ({ ...member, user: allUsers.find(user => user.id === member.userId) }));
    return { ...team, ...this.capabilities(team, actor, members), members, memberCount: members.length, issueCount: assigned.length, issues: assigned, cycles: teamCycles };
  }

  private writeError(error: unknown): never {
    const failure = error as { constraint?: string; cause?: { constraint?: string } };
    const constraint = failure.constraint ?? failure.cause?.constraint;
    if (constraint === 'reka_last_writable_team_lead') throw new BadRequestException('Assign another writable team lead before removing or demoting the last lead');
    if (constraint === 'teams_key_unique') throw new ConflictException('Team key already exists');
    throw error;
  }

  async create(dto: CreateTeamDto, actorId: string) {
    const db = this.database.db, actor = await requireWorkspace(db, actorId); requireWrite(actor);
    const key = dto.key.trim().toUpperCase(), id = randomUUID();
    if (!dto.name?.trim() || !/^[A-Z][A-Z0-9]{0,9}$/.test(key)) throw new BadRequestException('A team name and alphanumeric key are required');
    try {
      await db.execute(sql`
        WITH created AS (
          INSERT INTO teams (id, organization_id, name, key, description, is_private)
          SELECT ${id}::uuid, ${actor.organizationId}::uuid, ${dto.name.trim()}, ${key}, ${dto.description?.trim() || null}, ${dto.isPrivate ?? false}
          WHERE ${membershipScope(db, actor)} RETURNING id
        ) INSERT INTO team_members (team_id, user_id, role) SELECT id, ${actorId}::uuid, 'lead' FROM created
      `);
      await db.insert(teamWorkflowStates).values(DEFAULT_TEAM_WORKFLOW_STATES.map((state) => ({ teamId: id, ...state })));
      return await this.findById(id, actorId);
    } catch (error) { return this.writeError(error); }
  }

  private async eligibleLead(actor: WorkspaceActor, userId: string, role?: string) {
    await requireEligibleUser(this.database.db, actor, userId);
    if (role !== 'lead') return;
    const [membership] = await this.database.db.select().from(organizationMembers).where(and(eq(organizationMembers.organizationId, actor.organizationId), eq(organizationMembers.userId, userId)));
    if (!membership || !['owner', 'admin', 'member'].includes(membership.role)) throw new BadRequestException('A team lead must have writable workspace access');
  }

  async addMember(teamId: string, dto: AddTeamMemberDto, actorId: string) {
    const db = this.database.db, actor = await requireWorkspace(db, actorId);
    const team = await requireTeamManager(db, actor, teamId);
    await this.eligibleLead(actor, dto.userId, dto.role);
    const existing = await db.select().from(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, dto.userId)));
    if (existing.length) throw new ConflictException('User is already a member of this team');
    const result = await db.execute(sql`
      INSERT INTO team_members (team_id, user_id, role)
      SELECT ${teamId}::uuid, ${dto.userId}::uuid, ${dto.role ?? 'member'} FROM teams
      WHERE teams.id = ${teamId}::uuid AND ${teamManagerScope(db, actor)}
        AND EXISTS (SELECT 1 FROM organization_members target WHERE target.organization_id = ${actor.organizationId}::uuid
          AND target.user_id = ${dto.userId}::uuid AND target.is_active
          AND (${dto.role ?? 'member'} <> 'lead' OR target.role IN ('owner','admin','member')))
      RETURNING team_id AS "teamId", user_id AS "userId", role, created_at AS "createdAt"
    `);
    const member = result.rows[0] as { teamId: string; userId: string; role: string; createdAt: string } | undefined;
    if (!member) throw new NotFoundException('Team membership permission changed');
    if (dto.userId !== actorId) await this.notificationsService.createForEvent(dto.userId, { type: 'team_invite', title: `Added to ${team.name}`,
      body: `You were added to team ${team.name}.`, link: `/teams/${teamId}`, metadata: { teamId, teamName: team.name, role: member.role } });
    return member;
  }

  async updateMember(teamId: string, userId: string, dto: UpdateTeamMemberDto, actorId: string) {
    const db = this.database.db, actor = await requireWorkspace(db, actorId);
    await requireTeamManager(db, actor, teamId); await this.eligibleLead(actor, userId, dto.role);
    try {
      const [updated] = await db.update(teamMembers).set({ role: dto.role }).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId),
        inArray(teamMembers.teamId, db.select({ id: teams.id }).from(teams).where(teamManagerScope(db, actor))),
        sql`EXISTS (SELECT 1 FROM organization_members target WHERE target.organization_id = ${actor.organizationId}::uuid AND target.user_id = ${userId}::uuid AND target.is_active AND (${dto.role} <> 'lead' OR target.role IN ('owner','admin','member')))`)).returning();
      if (!updated) throw new NotFoundException('Team member not found');
      return updated;
    } catch (error) { return this.writeError(error); }
  }

  async removeMember(teamId: string, userId: string, actorId: string) {
    const db = this.database.db, actor = await requireWorkspace(db, actorId); requireWrite(actor); requireResourceId(userId);
    await requireTeam(db, actor, teamId);
    if (actorId !== userId) await requireTeamManager(db, actor, teamId);
    try {
      const [removed] = await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId),
        inArray(teamMembers.teamId, db.select({ id: teams.id }).from(teams).where(actorId === userId ? teamScope(db, actor) : teamManagerScope(db, actor))))).returning();
      if (!removed) throw new NotFoundException('Team member not found');
      return { success: true };
    } catch (error) { return this.writeError(error); }
  }

  async getWorkflowStates(id: string, actorId: string) {
    const db = this.database.db, actor = await requireWorkspace(db, actorId);
    await requireTeam(db, actor, id);
    const configured = await db.select().from(teamWorkflowStates).where(eq(teamWorkflowStates.teamId, id)).orderBy(asc(teamWorkflowStates.position), asc(teamWorkflowStates.key));
    return configured.length ? configured : DEFAULT_TEAM_WORKFLOW_STATES.map((state) => ({ ...state, teamId: id, isActive: true }));
  }

  async updateWorkflowStates(id: string, dto: UpdateTeamWorkflowStatesDto, actorId: string) {
    const db = this.database.db, actor = await requireWorkspace(db, actorId);
    await requireTeamManager(db, actor, id);
    if (!dto.states.some((state) => state.isActive && ['backlog', 'unstarted', 'started'].includes(state.category)) ||
        !dto.states.some((state) => state.isActive && state.category === 'completed')) {
      throw new BadRequestException('Keep at least one active work state and one active completed state');
    }
    const positions = dto.states.map((state) => state.position);
    if (new Set(positions).size !== positions.length) throw new BadRequestException('Workflow positions must be unique');
    const usedStatuses = await db.select({ status: issues.status }).from(issues).where(eq(issues.teamId, id)).groupBy(issues.status);
    const existingTriageStates = await db.select({ key: teamWorkflowStates.key }).from(teamWorkflowStates)
      .where(and(eq(teamWorkflowStates.teamId, id), eq(teamWorkflowStates.category, 'triage')));
    const existingTriageKeys = new Set(existingTriageStates.map((state) => state.key));
    const recurringTemplates = await db.select({ template: issueRecurrences.template }).from(issueRecurrences)
      .where(and(eq(issueRecurrences.teamId, id), eq(issueRecurrences.enabled, true)));
    const intakeTemplates = await db.select({ defaultStatus: issueTemplates.defaultStatus }).from(issueTemplates)
      .where(and(eq(issueTemplates.teamId, id), eq(issueTemplates.isActive, true)));
    const requested = new Map(dto.states.map((state) => [state.key, state]));
    if (usedStatuses.some(({ status }) => !requested.get(status)?.isActive ||
          (existingTriageKeys.has(status) && requested.get(status)?.category !== 'triage')) ||
        recurringTemplates.some(({ template }) => !requested.get(template.status)?.isActive) ||
        intakeTemplates.some(({ defaultStatus }) => !requested.get(defaultStatus)?.isActive || requested.get(defaultStatus)?.category !== 'triage')) {
      throw new BadRequestException('A workflow state used by existing issues cannot be disabled or removed');
    }
    const keys = dto.states.map((state) => state.key);
    await db.update(teamWorkflowStates).set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(teamWorkflowStates.teamId, id), notInArray(teamWorkflowStates.key, keys)));
    await db.insert(teamWorkflowStates).values(dto.states.map((state) => ({ teamId: id, ...state, name: state.name.trim() })))
      .onConflictDoUpdate({
        target: [teamWorkflowStates.teamId, teamWorkflowStates.key],
        set: { name: sql`excluded.name`, category: sql`excluded.category`, color: sql`excluded.color`, position: sql`excluded.position`, isActive: sql`excluded.is_active`, updatedAt: new Date() },
      });
    return this.getWorkflowStates(id, actorId);
  }

  async update(id: string, dto: UpdateTeamDto, actorId: string) {
    const db = this.database.db, actor = await requireWorkspace(db, actorId);
    const previous = await requireTeamManager(db, actor, id);
    if (dto.name !== undefined && !dto.name?.trim()) throw new BadRequestException('Team name cannot be empty');
    if (dto.key !== undefined && !/^[A-Z][A-Z0-9]{0,9}$/i.test(dto.key?.trim() ?? '')) throw new BadRequestException('Team key must be alphanumeric');
    const changed = db.$with('updated_team').as(db.update(teams).set({ ...dto, name: dto.name?.trim(), key: dto.key?.trim().toUpperCase(),
      description: dto.description !== undefined ? dto.description?.trim() || null : undefined, updatedAt: new Date(),
    }).where(and(eq(teams.id, id), teamManagerScope(db, actor))).returning({ id: teams.id }));
    try {
      if (dto.isPrivate === true && !previous.isPrivate) {
        const values = [
          sql`is_private = ${dto.isPrivate}`,
          ...(dto.name !== undefined ? [sql`name = ${dto.name.trim()}`] : []),
          ...(dto.key !== undefined ? [sql`key = ${dto.key.trim().toUpperCase()}`] : []),
          ...(dto.description !== undefined ? [sql`description = ${dto.description.trim() || null}`] : []),
          sql`updated_at = now()`,
        ];
        const enrolled = await db.execute(sql`
          WITH changed_team AS (
            UPDATE teams SET ${sql.join(values, sql`, `)} WHERE id = ${id}::uuid AND ${teamManagerScope(db, actor)} RETURNING id
          )
          INSERT INTO team_members (team_id, user_id, role)
          SELECT id, ${actorId}::uuid, 'lead'::varchar FROM changed_team
          ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'lead'
          RETURNING team_id
        `);
        if (!enrolled.rows.length) throw new NotFoundException('Team not found');
      } else {
        const [updated] = await db.with(changed).select().from(changed);
        if (!updated) throw new NotFoundException('Team not found');
      }
      return await this.findById(id, actorId);
    } catch (error) { return this.writeError(error); }
  }

  async delete(id: string, actorId: string) {
    const db = this.database.db, actor = await requireWorkspace(db, actorId); requireAdmin(actor);
    await requireTeam(db, actor, id);
    await db.delete(teams).where(and(eq(teams.id, id), teamScope(db, actor)));
    return { success: true };
  }

  async join(id: string, actorId: string) {
    const db = this.database.db, actor = await requireWorkspace(db, actorId); requireWrite(actor);
    await requireTeam(db, actor, id);
    const result = await db.execute(sql`
      INSERT INTO team_members (team_id,user_id,role) SELECT teams.id, ${actorId}::uuid, 'member' FROM teams
      WHERE teams.id = ${id}::uuid AND NOT teams.is_private AND ${teamScope(db, actor)}
      ON CONFLICT (team_id,user_id) DO UPDATE SET role = team_members.role RETURNING user_id
    `);
    if (!result.rows.length) throw new BadRequestException('Only public teams allow self-join');
    return { success: true };
  }
}
