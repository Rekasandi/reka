import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { sessions } from '@reka/database';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { requireWorkspace, requireWrite, type WorkspaceActor } from '../common/access/workspace-access';
import { sessionToken } from './session-cookie';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly database: DatabaseService) {}

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

    const [session] = await this.database.db.select().from(sessions).where(eq(sessions.id, token));
    if (!session || Date.now() >= new Date(session.expiresAt).getTime()) {
      throw new UnauthorizedException('Session expired');
    }
    request.workspace = await requireWorkspace(this.database.db, session.userId);
    // Legacy guest/client identities remain internal read-only accounts. Own
    // Inbox read/delete operations are personal state, not shared-content edits.
    const personalInboxMutation = request.path.startsWith('/api/notifications/') && ['PATCH', 'DELETE'].includes(request.method);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !personalInboxMutation) requireWrite(request.workspace);
    request.userId = session.userId;
    return true;
  }
}
