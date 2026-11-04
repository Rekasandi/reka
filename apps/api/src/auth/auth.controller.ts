import { All, Controller, Get, Inject, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { eq } from 'drizzle-orm';
import { organizations, users } from '@reka/database';
import { DatabaseService } from '../common/database/database.service';
import { AUTH, type Auth } from './better-auth';
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
