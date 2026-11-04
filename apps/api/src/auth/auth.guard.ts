import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException, Optional } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { RedisService } from '../common/redis/redis.service';
import { sessions } from '@reka/database';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { requireWorkspace, requireWrite, type WorkspaceActor } from '../common/access/workspace-access';
import { sessionToken } from './session-cookie';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly database: DatabaseService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { userId?: string; workspace?: WorkspaceActor }>();
    const path = request.path;
    const cookie = request.cookies?.[process.env.NODE_ENV === 'production' ? '__Host-reka_session' : 'reka_session'];
    if (cookie && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const trustedOrigin = new URL(process.env.WEB_URL || 'http://localhost:5173').origin;
      if (request.headers.origin !== trustedOrigin) throw new ForbiddenException('Untrusted request origin');
    }
    if (
      path === '/api/health' ||
      path === '/api/auth/github' ||
      path === '/api/auth/github/callback' ||
      path === '/api/auth/logout' ||
      path === '/api/integrations/github/webhook'
    ) return true;

    const token = sessionToken(request);
    if (!token) throw new UnauthorizedException('Login with GitHub required');

    let sessionUserId: string | null = null;
    let sessionExpiresAt: number | null = null;

    const cachedSession = await this.redis?.getSafe(`session:${token}`);
    if (cachedSession) {
      try {
        const parsed = JSON.parse(cachedSession);
        if (parsed?.userId && parsed?.expiresAt) {
          sessionUserId = parsed.userId;
          sessionExpiresAt = Number(parsed.expiresAt);
        }
      } catch {
        /* fallback to database */
      }
    }

    if (!sessionUserId || !sessionExpiresAt) {
      const [session] = await this.database.db.select().from(sessions).where(eq(sessions.id, token));
      if (!session || Date.now() >= new Date(session.expiresAt).getTime()) {
        throw new UnauthorizedException('Session expired');
      }
      sessionUserId = session.userId;
      sessionExpiresAt = new Date(session.expiresAt).getTime();
      const ttl = Math.floor((sessionExpiresAt - Date.now()) / 1000);
      if (ttl > 0) {
        await this.redis?.setSafe(`session:${token}`, JSON.stringify({ userId: sessionUserId, expiresAt: sessionExpiresAt }), Math.min(ttl, 3600));
      }
    } else if (Date.now() >= sessionExpiresAt) {
      await this.redis?.delSafe(`session:${token}`);
      throw new UnauthorizedException('Session expired');
    }

    let workspaceActor: WorkspaceActor | null = null;
    const cachedActor = await this.redis?.getSafe(`workspace_actor:${sessionUserId}`);
    if (cachedActor) {
      try {
        const parsed = JSON.parse(cachedActor);
        if (parsed?.userId && parsed?.organizationId && parsed?.role) {
          workspaceActor = parsed;
        }
      } catch {
        /* fallback to database */
      }
    }

    if (!workspaceActor) {
      workspaceActor = await requireWorkspace(this.database.db, sessionUserId);
      await this.redis?.setSafe(`workspace_actor:${sessionUserId}`, JSON.stringify(workspaceActor), 120);
    }

    request.workspace = workspaceActor;
    // Legacy guest/client identities remain internal read-only accounts. Own
    // Inbox read/delete operations are personal state, not shared-content edits.
    const personalInboxMutation = request.path.startsWith('/api/notifications/') && ['PATCH', 'DELETE'].includes(request.method);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !personalInboxMutation) requireWrite(request.workspace);
    request.userId = sessionUserId;
    return true;
  }
}
