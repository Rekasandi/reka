import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { tap } from 'rxjs';
import type { WorkspaceActor } from '../common/access/workspace-access';
import { NotificationsService } from './notifications.service';

/** After a successful write to issues/comments/triage/reactions, tells open live streams that issue data changed. */
@Injectable()
export class LiveIssuesInterceptor implements NestInterceptor {
  constructor(private readonly notifications: NotificationsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request & { userId?: string; workspace?: WorkspaceActor }>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next.handle();
    return next.handle().pipe(tap((body: { teamId?: unknown } | undefined) => {
      if (!request.workspace || !request.userId) return;
      this.notifications.issuesChanged(request.workspace.organizationId, typeof body?.teamId === 'string' ? body.teamId : null, request.userId);
    }));
  }
}
