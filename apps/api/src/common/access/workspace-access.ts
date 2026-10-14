import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  type DbClient, organizationMembers, users, teams, teamMembers,
  issues, projects, cycles, clients, labels, activities, notifications,
  githubRepositories, githubInstallations, projectRepositories, projectMembers, documents,
} from '@reka/database';
import { and, eq, exists, inArray, isNull, notExists, or, sql, type SQL } from 'drizzle-orm';
import type { UserRole } from '@reka/types';

export type WorkspaceRole = UserRole;
export interface WorkspaceActor {
  userId: string;
  organizationId: string;
  role: WorkspaceRole;
}

// Membership, not users.role or a valid session alone, grants company access.
// Explicit actor arguments avoid ambient/session state on the Neon HTTP driver.
export async function requireWorkspace(db: DbClient, userId: string): Promise<WorkspaceActor> {
  const memberships = await db.select().from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.isActive, true))).limit(2);
  const member = memberships[0];
  if (memberships.length !== 1 || !member || !['owner', 'admin', 'member', 'guest', 'client'].includes(member.role)) {
    throw new ForbiddenException('Active membership in the company workspace is required');
  }
  return { userId, organizationId: member.organizationId, role: member.role as WorkspaceRole };
}

export function requireWrite(actor: WorkspaceActor) {
  if (actor.role === 'guest' || actor.role === 'client') throw new ForbiddenException('This workspace membership is read-only');
}

export function requireAdmin(actor: WorkspaceActor) {
  if (actor.role !== 'owner' && actor.role !== 'admin') throw new ForbiddenException('Workspace administrator permission required');
}

export function membershipScope(db: DbClient, actor: WorkspaceActor): SQL {
  return exists(db.select({ one: sql`1` }).from(organizationMembers).where(and(
    eq(organizationMembers.organizationId, actor.organizationId), eq(organizationMembers.userId, actor.userId),
    eq(organizationMembers.isActive, true), eq(organizationMembers.role, actor.role),
  )));
}

export function teamScope(db: DbClient, actor: WorkspaceActor): SQL {
  return and(membershipScope(db, actor), eq(teams.organizationId, actor.organizationId), or(
    eq(teams.isPrivate, false),
    exists(db.select({ one: sql`1` }).from(teamMembers)
      .where(and(eq(teamMembers.teamId, teams.id), eq(teamMembers.userId, actor.userId)))),
  ))!;
}

export function teamManagerScope(db: DbClient, actor: WorkspaceActor): SQL {
  if (actor.role === 'guest' || actor.role === 'client') return sql`false`;
  return and(teamScope(db, actor), actor.role === 'owner' || actor.role === 'admin' ? sql`true` :
    exists(db.select({ one: sql`1` }).from(teamMembers).where(and(eq(teamMembers.teamId, teams.id), eq(teamMembers.userId, actor.userId), eq(teamMembers.role, 'lead')))))!;
}

export function visibleTeamIds(db: DbClient, actor: WorkspaceActor) {
  return db.select({ id: teams.id }).from(teams).where(teamScope(db, actor));
}

export function issueScope(db: DbClient, actor: WorkspaceActor): SQL {
  return inArray(issues.teamId, visibleTeamIds(db, actor));
}

export function projectScope(db: DbClient, actor: WorkspaceActor): SQL {
  return and(membershipScope(db, actor), eq(projects.organizationId, actor.organizationId), or(
    isNull(projects.teamId), inArray(projects.teamId, visibleTeamIds(db, actor)),
  ))!;
}

export function documentScope(db: DbClient, actor: WorkspaceActor): SQL {
  return and(eq(documents.organizationId, actor.organizationId), or(
    and(isNull(documents.teamId), isNull(documents.projectId)),
    inArray(documents.teamId, visibleTeamIds(db, actor)),
    inArray(documents.projectId, db.select({ id: projects.id }).from(projects).where(projectScope(db, actor))),
  ))!;
}

export function cycleScope(db: DbClient, actor: WorkspaceActor): SQL {
  return inArray(cycles.teamId, visibleTeamIds(db, actor));
}

export function userScope(db: DbClient, actor: WorkspaceActor): SQL {
  return inArray(users.id, db.select({ id: organizationMembers.userId }).from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, actor.organizationId), eq(organizationMembers.isActive, true))));
}

export function clientScope(actor: WorkspaceActor): SQL {
  return eq(clients.organizationId, actor.organizationId);
}

export function labelScope(db: DbClient, actor: WorkspaceActor): SQL {
  // Legacy unscoped labels are not silently assigned to this company.
  return and(eq(labels.organizationId, actor.organizationId), or(
    isNull(labels.teamId), inArray(labels.teamId, visibleTeamIds(db, actor)),
  ), or(isNull(labels.projectId), inArray(labels.projectId, db.select({ id: projects.id }).from(projects).where(projectScope(db, actor)))))!;
}

export function activityScope(db: DbClient, actor: WorkspaceActor): SQL {
  // Unlinked legacy activity has no proven company scope: fail closed.
  return and(
    or(inArray(activities.issueId, db.select({ id: issues.id }).from(issues).where(issueScope(db, actor))),
      inArray(activities.projectId, db.select({ id: projects.id }).from(projects).where(projectScope(db, actor)))),
    or(isNull(activities.issueId), inArray(activities.issueId, db.select({ id: issues.id }).from(issues).where(issueScope(db, actor)))),
    or(isNull(activities.projectId), inArray(activities.projectId, db.select({ id: projects.id }).from(projects).where(projectScope(db, actor)))),
  )!;
}

export function notificationScope(db: DbClient, actor: WorkspaceActor): SQL {
  // Compare text to text, never cast untrusted JSON IDs to UUID. Re-check current
  // permissions on read so previously delivered private text disappears on revoke.
  const allowedIssues = db.select({ id: sql<string>`${issues.id}::text` }).from(issues).where(issueScope(db, actor));
  const allowedProjects = db.select({ id: sql<string>`${projects.id}::text` }).from(projects).where(projectScope(db, actor));
  const allowedTeams = db.select({ id: sql<string>`${teams.id}::text` }).from(teams).where(teamScope(db, actor));
  return and(eq(notifications.userId, actor.userId),
    or(sql`${notifications.metadata}->>'issueId' IS NULL`, inArray(sql`${notifications.metadata}->>'issueId'`, allowedIssues)),
    or(sql`${notifications.metadata}->>'projectId' IS NULL`, inArray(sql`${notifications.metadata}->>'projectId'`, allowedProjects)),
    or(sql`${notifications.metadata}->>'teamId' IS NULL`, inArray(sql`${notifications.metadata}->>'teamId'`, allowedTeams)),
  )!;
}

export function requireResourceId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new BadRequestException('Invalid resource ID');
  }
}

export function repositoryScope(db: DbClient, actor: WorkspaceActor): SQL {
  return and(inArray(githubRepositories.installationId,
    db.select({ id: githubInstallations.id }).from(githubInstallations).where(eq(githubInstallations.organizationId, actor.organizationId))),
    or(notExists(db.select({ one: sql`1` }).from(projectRepositories).where(eq(projectRepositories.repositoryId, githubRepositories.id))),
      exists(db.select({ one: sql`1` }).from(projectRepositories).innerJoin(projects, eq(projectRepositories.projectId, projects.id))
        .where(and(eq(projectRepositories.repositoryId, githubRepositories.id), projectScope(db, actor))))),
  )!;
}

export async function requireTeam(db: DbClient, actor: WorkspaceActor, id: string) {
  requireResourceId(id);
  const [team] = await db.select().from(teams).where(and(eq(teams.id, id), teamScope(db, actor)));
  if (!team) throw new NotFoundException('Team not found');
  return team;
}

export async function requireTeamWrite(db: DbClient, actor: WorkspaceActor, id: string) {
  const team = await requireTeam(db, actor, id);
  requireWrite(actor);
  const [member] = await db.select().from(teamMembers).where(and(eq(teamMembers.teamId, id), eq(teamMembers.userId, actor.userId)));
  if (!member) throw new ForbiddenException('Active team membership is required to make changes');
  if (member.role === 'viewer') throw new ForbiddenException('This team membership is read-only');
  return team;
}

export async function requireTeamManager(db: DbClient, actor: WorkspaceActor, id: string) {
  const team = await requireTeam(db, actor, id); // Admin is NOT a private-content bypass.
  requireWrite(actor);
  if (actor.role === 'owner' || actor.role === 'admin') return team;
  const [member] = await db.select().from(teamMembers)
    .where(and(eq(teamMembers.teamId, id), eq(teamMembers.userId, actor.userId), eq(teamMembers.role, 'lead')));
  if (!member) throw new ForbiddenException('Team lead or workspace administrator permission required');
  return team;
}

export async function requireIssue(db: DbClient, actor: WorkspaceActor, id: string) {
  requireResourceId(id);
  const [issue] = await db.select().from(issues).where(and(eq(issues.id, id), issueScope(db, actor)));
  if (!issue) throw new NotFoundException('Issue not found');
  return issue;
}

export async function requireIssueWrite(db: DbClient, actor: WorkspaceActor, id: string) {
  const issue = await requireIssue(db, actor, id);
  await requireTeamWrite(db, actor, issue.teamId);
  return issue;
}

export async function requireDocument(db: DbClient, actor: WorkspaceActor, id: string) {
  requireResourceId(id);
  const [document] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.organizationId, actor.organizationId)));
  if (!document) throw new NotFoundException('Document not found');
  if (document.projectId) await requireProject(db, actor, document.projectId);
  else if (document.teamId) await requireTeam(db, actor, document.teamId);
  return document;
}

export async function requireProject(db: DbClient, actor: WorkspaceActor, id: string) {
  requireResourceId(id);
  const [project] = await db.select().from(projects).where(and(eq(projects.id, id), projectScope(db, actor)));
  if (!project) throw new NotFoundException('Project not found');
  return project;
}

export async function requireProjectManager(db: DbClient, actor: WorkspaceActor, id: string) {
  const project = await requireProject(db, actor, id);
  requireWrite(actor);
  if (actor.role === 'owner' || actor.role === 'admin' || project.ownerId === actor.userId) return project;
  const [member] = await db.select().from(projectMembers)
    .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, actor.userId), eq(projectMembers.role, 'owner')));
  if (member) return project;
  if (project.teamId) {
    const [lead] = await db.select().from(teamMembers)
      .where(and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, actor.userId), eq(teamMembers.role, 'lead')));
    if (lead) return project;
  }
  throw new ForbiddenException('Project lead, team lead or workspace administrator permission required');
}

export async function requireCycle(db: DbClient, actor: WorkspaceActor, id: string) {
  requireResourceId(id);
  const [cycle] = await db.select().from(cycles).where(and(eq(cycles.id, id), cycleScope(db, actor)));
  if (!cycle) throw new NotFoundException('Cycle not found');
  return cycle;
}

export async function requireEligibleUser(db: DbClient, actor: WorkspaceActor, userId: string, teamId?: string) {
  requireResourceId(userId);
  const [user] = await db.select().from(users).where(and(eq(users.id, userId), userScope(db, actor)));
  if (!user) throw new BadRequestException('User must be an active workspace member');
  if (teamId) {
    const [team] = await db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.organizationId, actor.organizationId)));
    if (!team) throw new BadRequestException('User is not eligible for this team');
    if (team.isPrivate) {
      const [member] = await db.select().from(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
      if (!member) throw new BadRequestException('User must explicitly belong to this private team');
    }
  }
  return user;
}
