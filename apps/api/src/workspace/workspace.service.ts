import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { organizations, organizationMembers, users, workspaceInvitations } from '@reka/database';
import { DatabaseService } from '../common/database/database.service';
import { membershipScope, requireAdmin, requireResourceId, requireWorkspace } from '../common/access/workspace-access';
import { CreateWorkspaceInvitationDto, UpdateWorkspaceDto, UpdateWorkspaceMemberDto } from './dto/workspace.dto';
import type { UpdateUserDto } from '../users/dto/user.dto';

export const secretHash = (value: string) => createHash('sha256').update(value).digest('hex');
export interface VerifiedGithubIdentity {
  id: string;
  login: string;
  name: string;
  avatarUrl: string | null;
  verifiedEmails: string[];
}

@Injectable()
export class WorkspaceService {
  constructor(private readonly database: DatabaseService) {}

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
    const rows = await this.database.db.select({ user: users, role: organizationMembers.role, isActive: organizationMembers.isActive, admission: organizationMembers.admission })
      .from(organizationMembers).innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(and(eq(organizationMembers.organizationId, actor.organizationId), membershipScope(this.database.db, actor), admin ? undefined : eq(organizationMembers.isActive, true)))
      .orderBy(desc(users.createdAt));
    return rows.map(({ user, role, isActive, admission }) => ({ ...user, role, isActive, admission }));
  }

  async updateMember(actorId: string, id: string, dto: UpdateWorkspaceMemberDto, profile: UpdateUserDto = {}) {
    const db = this.database.db;
    const actor = await requireWorkspace(db, actorId);
    requireAdmin(actor);
    requireResourceId(id);
    const [target] = await db.select({ user: users, role: organizationMembers.role, isActive: organizationMembers.isActive, admission: organizationMembers.admission })
      .from(organizationMembers).innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(and(eq(organizationMembers.organizationId, actor.organizationId), eq(organizationMembers.userId, id)));
    if (!target) throw new NotFoundException('Workspace member not found');
    if ((target.role === 'owner' || dto.role === 'owner') && actor.role !== 'owner') {
      throw new ForbiddenException('Only an owner can manage owner accounts');
    }
    if (target.admission === 'pending' && (dto.isActive === true || dto.role === 'owner')) {
      throw new BadRequestException('Pending profiles must join through a verified GitHub invitation before activation or owner assignment');
    }
    // An administrator must not take over a private member's unbound legacy
    // identity by editing their login email. Identity changes need verified relinking.
    if (profile.email !== undefined && profile.email?.trim().toLowerCase() !== target.user.email) {
      throw new BadRequestException('Login email changes require verified identity relinking');
    }
    if (profile.name !== undefined && !profile.name?.trim()) throw new BadRequestException('Name cannot be empty');
    const changed = db.$with('changed_member').as(db.update(organizationMembers)
      .set({ role: dto.role ?? target.role, isActive: dto.isActive ?? target.isActive })
      .where(and(eq(organizationMembers.organizationId, actor.organizationId), eq(organizationMembers.userId, id), membershipScope(db, actor)))
      .returning({ userId: organizationMembers.userId, role: organizationMembers.role, isActive: organizationMembers.isActive }));
    try {
      // A single PostgreSQL statement: profile and canonical role change together.
      // Works on Neon HTTP and PGlite; no interactive transaction assumption.
      const [updated] = await db.with(changed).update(users).set({
        role: sql`(SELECT role FROM changed_member)`,
        name: profile.name?.trim(),
        avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl?.trim() || null : undefined,
        updatedAt: new Date(),
      }).where(inArray(users.id, db.select({ id: changed.userId }).from(changed)))
        .returning({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl,
          githubUsername: users.githubUsername, githubId: users.githubId, role: users.role,
          createdAt: users.createdAt, updatedAt: users.updatedAt, isActive: sql<boolean>`(SELECT is_active FROM changed_member)` });
      if (!updated) throw new ForbiddenException('Workspace permission changed');
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

  async findInvitations(actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    requireAdmin(actor);
    // Link secrets/hashes are never exposed by list reads.
    return this.database.db.select({ id: workspaceInvitations.id, email: workspaceInvitations.email,
      role: workspaceInvitations.role, expiresAt: workspaceInvitations.expiresAt,
      acceptedAt: workspaceInvitations.acceptedAt, revokedAt: workspaceInvitations.revokedAt,
      invitedById: workspaceInvitations.invitedById, createdAt: workspaceInvitations.createdAt })
      .from(workspaceInvitations).where(and(eq(workspaceInvitations.organizationId, actor.organizationId), membershipScope(this.database.db, actor)))
      .orderBy(desc(workspaceInvitations.createdAt));
  }

  async createInvitation(actorId: string, dto: CreateWorkspaceInvitationDto) {
    const db = this.database.db;
    const actor = await requireWorkspace(db, actorId);
    requireAdmin(actor);
    const email = dto.email.trim().toLowerCase();
    const [existing] = await db.select({ organizationId: organizationMembers.organizationId, role: organizationMembers.role, isActive: organizationMembers.isActive })
      .from(users).innerJoin(organizationMembers, eq(users.id, organizationMembers.userId))
      .where(eq(users.email, email));
    if (existing && (existing.organizationId !== actor.organizationId || existing.isActive || !['admin', 'member'].includes(existing.role))) {
      throw new ConflictException('Existing accounts must be managed through workspace membership settings');
    }
    const token = randomBytes(32).toString('hex');
    const role = dto.role ?? (existing?.role === 'admin' ? 'admin' : 'member');
    const expiresAt = new Date(Date.now() + (dto.expiresInDays ?? 7) * 86400000);
    const issued = await db.execute(sql`
      INSERT INTO workspace_invitations (organization_id, email, role, token_hash, invited_by_id, expires_at)
      SELECT ${actor.organizationId}::uuid, ${email}, ${role}, ${secretHash(token)}, ${actorId}::uuid, ${expiresAt.toISOString()}::timestamptz
      WHERE ${membershipScope(db, actor)} RETURNING id, email, role, expires_at AS "expiresAt"
    `);
    const invite = issued.rows[0] as { id: string; email: string; role: string; expiresAt: string } | undefined;
    if (!invite) throw new ForbiddenException('Workspace permission changed');
    const url = new URL('/login', process.env.WEB_URL || 'http://localhost:5173');
    url.searchParams.set('invite', token);
    return { ...invite, url: url.toString() };
  }

  async revokeInvitation(actorId: string, id: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    requireAdmin(actor);
    requireResourceId(id);
    const [revoked] = await this.database.db.update(workspaceInvitations).set({ revokedAt: new Date() })
      .where(and(eq(workspaceInvitations.id, id), eq(workspaceInvitations.organizationId, actor.organizationId), membershipScope(this.database.db, actor), isNull(workspaceInvitations.acceptedAt)))
      .returning({ id: workspaceInvitations.id });
    if (!revoked) throw new NotFoundException('Pending invitation not found');
    return { success: true };
  }

  async requirePendingInvitation(hash: string) {
    const [invite] = await this.database.db.select().from(workspaceInvitations).where(and(
      eq(workspaceInvitations.tokenHash, hash), isNull(workspaceInvitations.acceptedAt),
      isNull(workspaceInvitations.revokedAt), gt(workspaceInvitations.expiresAt, new Date()),
    ));
    if (!invite) throw new UnauthorizedException('Invitation is invalid, expired or already used');
    return invite;
  }

  async findGithubAccount(identity: VerifiedGithubIdentity) {
    const [bound] = await this.database.db.select().from(users).where(eq(users.githubId, identity.id));
    if (bound) return bound;
    const matches = await this.database.db.select().from(users).where(inArray(users.email, identity.verifiedEmails)).limit(2);
    if (matches.length > 1 || (matches[0]?.githubId && matches[0].githubId !== identity.id)) {
      throw new UnauthorizedException('GitHub identity requires an account-linking review');
    }
    return matches[0];
  }

  // Only the verified OAuth callback calls this. There is no public endpoint
  // accepting a client-supplied email/GitHub identity or invitation hash.
  async acceptGithubInvitation(hash: string, identity: VerifiedGithubIdentity) {
    const existing = await this.findGithubAccount(identity);
    const id = existing?.id ?? randomUUID();
    const token = randomUUID();
    const verified = sql.join(identity.verifiedEmails.map(email => sql`${email}`), sql`, `);
    const result = await this.database.db.execute(sql`
      WITH pending AS MATERIALIZED (
        SELECT * FROM workspace_invitations WHERE token_hash = ${hash}
          AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
        FOR UPDATE
      ), eligible AS (
        SELECT p.* FROM pending p WHERE p.email IN (${verified})
          AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = p.email AND u.id <> ${id}::uuid)
          AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ${id}::uuid AND u.github_id IS NOT NULL AND u.github_id <> ${identity.id})
          AND NOT EXISTS (SELECT 1 FROM organization_members m WHERE m.user_id = ${id}::uuid
            AND (m.is_active OR m.role NOT IN ('admin', 'member')))
      ), account AS (
        INSERT INTO users (id, email, name, avatar_url, github_username, github_id, role)
        SELECT ${id}::uuid, COALESCE(${existing?.email ?? null}::text, e.email),
          ${identity.name}, ${identity.avatarUrl}, ${identity.login}, ${identity.id}, e.role
        FROM eligible e
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url,
          github_username = EXCLUDED.github_username, github_id = EXCLUDED.github_id, role = EXCLUDED.role, updated_at = now()
          WHERE users.github_id IS NULL OR users.github_id = EXCLUDED.github_id
        RETURNING id
      ), granted AS (
        INSERT INTO organization_members (organization_id, user_id, role, is_active, admission)
        SELECT e.organization_id, a.id, e.role, true, 'invited' FROM eligible e CROSS JOIN account a
        ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, is_active = true, admission = 'invited'
          WHERE NOT organization_members.is_active AND organization_members.role IN ('admin', 'member')
        RETURNING user_id
      ), consumed AS (
        UPDATE workspace_invitations i SET accepted_at = now(), accepted_by_id = g.user_id
        FROM granted g, eligible e WHERE i.id = e.id RETURNING g.user_id
      ), signed_in AS (
        INSERT INTO sessions (id, user_id, expires_at)
        SELECT ${token}, c.user_id, now() + interval '7 days' FROM consumed c RETURNING user_id
      ) SELECT user_id AS id FROM signed_in
    `);
    const accepted = result.rows[0] as { id: string } | undefined;
    if (!accepted) throw new UnauthorizedException('Invitation does not match this verified GitHub account or membership state');
    const [user] = await this.database.db.select().from(users).where(eq(users.id, accepted.id));
    const actor = await requireWorkspace(this.database.db, user.id);
    return { user: { ...user, role: actor.role }, token };
  }
}
