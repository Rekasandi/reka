import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { issues, teamMembers, teams } from '@reka/database';
import { and, eq, inArray } from 'drizzle-orm';
import { UpdateUserDto } from './dto/user.dto';
import { WorkspaceService } from '../workspace/workspace.service';
import { requireAdmin, requireResourceId, requireWorkspace, issueScope, visibleTeamIds } from '../common/access/workspace-access';

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService, private readonly workspace: WorkspaceService) {}

  async findAll(actorId: string, includeInactive = false) {
    const db = this.database.db;
    const actor = await requireWorkspace(db, actorId);
    if (includeInactive) requireAdmin(actor);
    const members = (await this.workspace.findMembers(actorId)).filter(member => includeInactive || member.isActive);
    const [assigned, memberships] = await Promise.all([
      db.select({ assigneeId: issues.assigneeId }).from(issues).where(issueScope(db, actor)),
      db.select({
        userId: teamMembers.userId,
        teamId: teamMembers.teamId,
        teamKey: teams.key,
        teamName: teams.name,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(inArray(teamMembers.teamId, visibleTeamIds(db, actor))),
    ]);
    const issueCounts = new Map<string, number>();
    const userTeamsMap = new Map<string, Array<{ id: string; key: string; name: string }>>();
    for (const row of assigned) if (row.assigneeId) issueCounts.set(row.assigneeId, (issueCounts.get(row.assigneeId) ?? 0) + 1);
    for (const row of memberships) {
      const list = userTeamsMap.get(row.userId) ?? [];
      list.push({ id: row.teamId, key: row.teamKey, name: row.teamName });
      userTeamsMap.set(row.userId, list);
    }
    return members.map(member => ({
      ...member,
      assignedIssuesCount: issueCounts.get(member.id) ?? 0,
      teamsCount: userTeamsMap.get(member.id)?.length ?? 0,
      teams: userTeamsMap.get(member.id) ?? [],
    }));
  }

  async findById(actorId: string, id: string) {
    requireResourceId(id);
    const actor = await requireWorkspace(this.database.db, actorId);
    const members = await this.findAll(actorId, actor.role === 'owner' || actor.role === 'admin');
    const user = members.find(member => member.id === id);
    if (!user) throw new NotFoundException('Workspace user not found');
    const assignedIssues = await this.database.db.select().from(issues).where(and(eq(issues.assigneeId, id), issueScope(this.database.db, actor)));
    return { ...user, assignedIssues };
  }

  async update(actorId: string, id: string, dto: UpdateUserDto) {
    return this.workspace.updateMember(actorId, id, { role: dto.role }, dto);
  }

  async delete(actorId: string, id: string) {
    // Removal is deactivation, preserving authored issues/history, invitations
    // and identity binding. Existing user routes stay usable without data loss.
    await this.workspace.updateMember(actorId, id, { isActive: false });
    return { success: true };
  }
}
