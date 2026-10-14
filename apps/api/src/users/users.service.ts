import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../common/database/database.service';
import { issues, teamMembers } from '@reka/database';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { WorkspaceService } from '../workspace/workspace.service';
import { requireAdmin, requireResourceId, requireWorkspace, membershipScope, issueScope, visibleTeamIds } from '../common/access/workspace-access';

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
      db.select({ userId: teamMembers.userId }).from(teamMembers).where(inArray(teamMembers.teamId, visibleTeamIds(db, actor))),
    ]);
    const issueCounts = new Map<string, number>(), teamCounts = new Map<string, number>();
    for (const row of assigned) if (row.assigneeId) issueCounts.set(row.assigneeId, (issueCounts.get(row.assigneeId) ?? 0) + 1);
    for (const row of memberships) teamCounts.set(row.userId, (teamCounts.get(row.userId) ?? 0) + 1);
    return members.map(member => ({ ...member, assignedIssuesCount: issueCounts.get(member.id) ?? 0, teamsCount: teamCounts.get(member.id) ?? 0 }));
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

  async create(actorId: string, dto: CreateUserDto) {
    const actor = await requireWorkspace(this.database.db, actorId);
    requireAdmin(actor);
    if (!dto.name?.trim()) throw new BadRequestException('Name cannot be empty');
    if (dto.role === 'owner') throw new BadRequestException('Assign ownership after the user has joined through an invitation');
    const id = randomUUID(), email = dto.email.trim().toLowerCase(), role = dto.role ?? 'member';
    try {
      // Preserve manual profile creation, but never turn it into an invitation
      // bypass. Profile + pending inactive membership are one atomic statement.
      await this.database.db.execute(sql`
        WITH profile AS (
          INSERT INTO users (id, email, name, avatar_url, role)
          SELECT ${id}::uuid, ${email}, ${dto.name.trim()}, ${dto.avatarUrl?.trim() || null}, ${role}
          WHERE ${membershipScope(this.database.db, actor)} RETURNING id
        ) INSERT INTO organization_members (organization_id, user_id, role, is_active, admission)
          SELECT ${actor.organizationId}::uuid, id, ${role}, false, 'pending' FROM profile
      `);
    } catch (error) {
      const failure = error as { constraint?: string; cause?: { constraint?: string } };
      if (failure.constraint === 'users_email_unique' || failure.cause?.constraint === 'users_email_unique') {
        throw new ConflictException('This email already belongs to an account');
      }
      throw error;
    }
    return this.findById(actorId, id);
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
