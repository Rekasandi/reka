import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { requireWrite } from '../common/access/workspace-access';
import type { AuthedRequest } from './session.middleware';

/** Every REKA endpoint needs a signed-in user with an active workspace; Better Auth routes, health and webhooks are public. */
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const path = request.path;
    if (path === '/api/health' || path.startsWith('/api/auth/') || path === '/api/integrations/github/webhook') return true;
    if (!request.userId) throw new UnauthorizedException('Sign in required');
    // Cookie sessions are ambient, so browser writes must come from the app itself (CSRF).
    if (request.authViaCookie && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const trustedOrigin = new URL(process.env.WEB_URL || 'http://localhost:5173').origin;
      if (request.headers.origin !== trustedOrigin) throw new ForbiddenException('Untrusted request origin');
    }
    if (!request.workspace) throw new ForbiddenException('Select or create a workspace first');
    // Legacy guest/client identities remain internal read-only accounts. Own
    // Inbox read/delete operations are personal state, not shared-content edits.
    const personalInboxMutation = path.startsWith('/api/notifications/') && ['PATCH', 'DELETE'].includes(request.method);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !personalInboxMutation) requireWrite(request.workspace);
    return true;
  }
}
