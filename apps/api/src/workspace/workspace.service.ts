import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { organizations, organizationMembers, users } from '@reka/database';
import { DatabaseService } from '../common/database/database.service';
import { RedisService } from '../common/redis/redis.service';
import { membershipScope, requireAdmin, requireResourceId, requireWorkspace } from '../common/access/workspace-access';
import { UpdateWorkspaceDto, UpdateWorkspaceMemberDto } from './dto/workspace.dto';
import type { UpdateUserDto } from '../users/dto/user.dto';

@Injectable()
export class WorkspaceService {
  constructor(private readonly database: DatabaseService, @Optional() private readonly redis?: RedisService) {}

  async findCurrent(actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const [org] = await this.database.db.select().from(organizations).where(and(eq(organizations.id, actor.organizationId), membershipScope(this.database.db, actor)));
    return { ...org, role: actor.role };
  }

  async update(actorId: string, dto: UpdateWorkspaceDto) {
    const actor = await requireWorkspace(this.database.db, actorId);
    requireAdmin(actor);
    if (dto.name !== undefined && !dto.name?.trim()) throw new BadRequestException('Workspace name cannot be empty');
    const [updated] = await this.database.db.update(organizations).set({ name: dto.name?.trim(), updatedAt: new Date() })
      .where(and(eq(organizations.id, actor.organizationId), membershipScope(this.database.db, actor))).returning();
    if (!updated) throw new ForbiddenException('Workspace permission changed');
    return { ...updated, role: actor.role };
  }

  async findMembers(actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const admin = actor.role === 'owner' || actor.role === 'admin';
    const rows = await this.database.db.select({ user: users, role: organizationMembers.role, isActive: organizationMembers.isActive })
      .from(organizationMembers).innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(and(eq(organizationMembers.organizationId, actor.organizationId), membershipScope(this.database.db, actor), admin ? undefined : eq(organizationMembers.isActive, true)))
      .orderBy(desc(users.createdAt));
    return rows.map(({ user, role, isActive }) => ({ ...user, role, isActive }));
  }

  async updateMember(actorId: string, id: string, dto: UpdateWorkspaceMemberDto, profile: UpdateUserDto = {}) {
    const db = this.database.db;
    const actor = await requireWorkspace(db, actorId);
    requireAdmin(actor);
    requireResourceId(id);
    const [target] = await db.select({ user: users, role: organizationMembers.role, isActive: organizationMembers.isActive })
      .from(organizationMembers).innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(and(eq(organizationMembers.organizationId, actor.organizationId), eq(organizationMembers.userId, id)));
    if (!target) throw new NotFoundException('Workspace member not found');
    if ((target.role === 'owner' || dto.role === 'owner') && actor.role !== 'owner') {
      throw new ForbiddenException('Only an owner can manage owner accounts');
    }
    // An administrator must not take over a private member's unbound legacy
    // identity by editing their login email. Identity changes need verified relinking.
    if (profile.email !== undefined && profile.email?.trim().toLowerCase() !== target.user.email) {
      throw new BadRequestException('Login email changes require verified identity relinking');
    }
    if (profile.name !== undefined && !profile.name?.trim()) throw new BadRequestException('Name cannot be empty');
    if (target.role === 'owner' && target.isActive && (dto.isActive === false || (dto.role !== undefined && dto.role !== 'owner'))) {
      const otherOwners = await db.select({ id: organizationMembers.userId })
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, actor.organizationId),
          eq(organizationMembers.role, 'owner'),
          eq(organizationMembers.isActive, true),
          sql`${organizationMembers.userId} <> ${id}`
        ))
        .limit(1);
      if (!otherOwners.length) {
        throw new BadRequestException('Cannot remove, deactivate or demote the last active workspace owner');
      }
    }
    const changed = db.$with('changed_member').as(db.update(organizationMembers)
      .set({ role: dto.role ?? target.role, isActive: dto.isActive ?? target.isActive })
      .where(and(eq(organizationMembers.organizationId, actor.organizationId), eq(organizationMembers.userId, id), membershipScope(db, actor)))
      .returning({ userId: organizationMembers.userId, role: organizationMembers.role, isActive: organizationMembers.isActive }));
    try {
      // A single PostgreSQL statement: profile and canonical role change together.
      // Works on Neon HTTP and PGlite; no interactive transaction assumption.
      const [updated] = await db.with(changed).update(users).set({
        name: profile.name?.trim(),
        avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl?.trim() || null : undefined,
        updatedAt: new Date(),
      }).where(inArray(users.id, db.select({ id: changed.userId }).from(changed)))
        .returning({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl,
          githubUsername: users.githubUsername, githubId: users.githubId, role: sql<string>`(SELECT role FROM changed_member)`,
          createdAt: users.createdAt, updatedAt: users.updatedAt, isActive: sql<boolean>`(SELECT is_active FROM changed_member)` });
      if (!updated) throw new ForbiddenException('Workspace permission changed');
      await this.redis?.delSafe(`workspace_actor:${id}`);
      return updated;
    } catch (error) {
      const failure = error as { constraint?: string; cause?: { constraint?: string } };
      const constraint = failure.constraint ?? failure.cause?.constraint;
      if (constraint === 'reka_workspace_last_team_lead') throw new BadRequestException('Arrange a team lead handoff before deactivating or making this member read-only');
      if (constraint === 'reka_last_active_owner') {
        throw new BadRequestException('Cannot remove, deactivate or demote the last active workspace owner');
      }
      throw error;
    }
  }
}
