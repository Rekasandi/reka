import { All, BadRequestException, Controller, Delete, ForbiddenException, Get, Inject, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { and, eq, sql } from 'drizzle-orm';
import { accounts, organizationMembers, organizations, sessions, users } from '@reka/database';
import { DatabaseService } from '../common/database/database.service';
import { AUTH, type Auth, webUrl } from './better-auth';
import type { AuthedRequest } from './session.middleware';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AUTH) private readonly auth: Auth, private readonly database: DatabaseService) {}

  /** The signed-in user plus the active workspace (null until one is created or joined). */
  @Get('me')
  async me(@Req() req: AuthedRequest) {
    if (!req.userId) throw new UnauthorizedException('Sign in required');
    const [user] = await this.database.db.select().from(users).where(eq(users.id, req.userId));
    if (!user) throw new UnauthorizedException('Sign in required');
    const workspace = req.workspace
      ? (await this.database.db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug, logoUrl: organizations.logoUrl }).from(organizations).where(eq(organizations.id, req.workspace.organizationId)))[0] ?? null
      : null;
    return { ...user, role: req.workspace?.role ?? 'member', workspace: workspace ? { ...workspace, role: req.workspace!.role } : null };
  }

  /**
   * Delete the signed-in account. Authored issues/comments keep their history (their FKs forbid a hard delete),
   * so the profile is anonymised and every sign-in method, session and membership is removed.
   */
  @Delete('account')
  async deleteAccount(@Req() req: AuthedRequest) {
    if (!req.userId) throw new UnauthorizedException('Sign in required');
    // Better Auth routes skip the guard's CSRF check, so repeat it here for cookie sessions.
    if (req.authViaCookie && req.headers.origin !== new URL(webUrl()).origin) throw new ForbiddenException('Untrusted request origin');
    const db = this.database.db, userId = req.userId;
    // Enforce: user cannot delete their account while being the sole active owner of a workspace
    const owned = await db.select({ orgId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.role, 'owner'), eq(organizationMembers.isActive, true)));
    for (const { orgId } of owned) {
      const other = await db.select({ id: organizationMembers.userId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.role, 'owner'), eq(organizationMembers.isActive, true), sql`${organizationMembers.userId} <> ${userId}`))
        .limit(1);
      if (!other.length) {
        throw new BadRequestException('Transfer ownership of, or delete, the workspaces you own first');
      }
    }
    await db.update(organizationMembers).set({ isActive: false }).where(eq(organizationMembers.userId, userId));
    await db.update(users).set({ name: 'Deleted user', email: `deleted-${userId}@users.invalid`, emailVerified: false, avatarUrl: null, githubId: null, githubUsername: null, updatedAt: new Date() }).where(eq(users.id, userId));
    await db.delete(accounts).where(eq(accounts.userId, userId));
    await db.delete(sessions).where(eq(sessions.userId, userId));
    return { success: true };
  }

  /** Everything else under /api/auth is Better Auth (sign-in, sign-up, magic link, GitHub, organizations). */
  @All('*splat')
  async handle(@Req() req: Request & { rawBody?: Buffer }, @Res() res: Response) {
    const url = new URL(req.originalUrl, process.env.API_URL || 'http://localhost:3000');
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const body = hasBody ? (req.rawBody && req.rawBody.length ? req.rawBody : req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : undefined) : undefined;
    const response = await this.auth.handler(new Request(url, { method: req.method, headers: fromNodeHeaders(req.headers), body: body as string | Buffer | undefined }));
    res.status(response.status);
    response.headers.forEach((value: string, key: string) => { if (key.toLowerCase() !== 'set-cookie') res.setHeader(key, value); });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader('set-cookie', cookies);
    res.send(Buffer.from(await response.arrayBuffer()));
  }
}
