import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { and, eq } from 'drizzle-orm';
import { organizationMembers, sessions } from '@reka/database';
import { DatabaseService } from '../common/database/database.service';
import { requestContext, type WorkspaceActor, type WorkspaceRole } from '../common/access/workspace-access';
import { AUTH, type Auth } from './better-auth';

export type AuthedRequest = Request & { userId?: string; workspace?: WorkspaceActor; sessionId?: string; authViaCookie?: boolean };

/** Resolves the Better Auth session once per request and exposes the active workspace to every service. */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(@Inject(AUTH) private readonly auth: Auth, private readonly database: DatabaseService) {}

  async use(req: AuthedRequest, _res: Response, next: NextFunction) {
    let organizationId: string | null | undefined;
    try {
      const result = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (result) {
        const userId = result.user.id;
        req.userId = userId;
        req.sessionId = result.session.id;
        req.authViaCookie = !req.headers.authorization;
        organizationId = (result.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;
        const memberships = await this.database.db.select({ organizationId: organizationMembers.organizationId, role: organizationMembers.role }).from(organizationMembers)
          .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.isActive, true), ...(organizationId ? [eq(organizationMembers.organizationId, organizationId)] : []))).limit(2);
        // A session opened before the user had a workspace (or whose workspace was removed) adopts their only one.
        const membership = organizationId ? memberships[0] : memberships.length === 1 ? memberships[0] : undefined;
        if (membership && ['owner', 'admin', 'member', 'guest', 'client'].includes(membership.role)) {
          req.workspace = { userId, organizationId: membership.organizationId, role: membership.role as WorkspaceRole };
          // Remember the adopted workspace on the session so Better Auth's organization endpoints see it too.
          if (!organizationId) await this.database.db.update(sessions).set({ activeOrganizationId: membership.organizationId }).where(eq(sessions.id, result.session.id));
        }
      }
    } catch { /* an unreadable session is the same as no session */ }
    requestContext.run({ userId: req.userId, organizationId: req.workspace?.organizationId ?? null, actor: req.workspace }, () => next());
  }
}
