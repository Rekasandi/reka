import { Controller, Get, Delete, Param, Res, Query, Req, BadRequestException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { GithubInstallationsService } from './installations.service';
import type { Request, Response } from 'express';
import { requireAdmin, type WorkspaceActor } from '../../common/access/workspace-access';
import { authCookieOptions } from '../../auth/session-cookie';

@Controller('integrations/github/installations')
export class GithubInstallationsController {
  constructor(private readonly service: GithubInstallationsService) {}

  @Get()
  findAll(@Req() req: Request & { workspace: WorkspaceActor }) {
    return this.service.findAll(req.workspace);
  }

  @Get('webhook-deliveries')
  webhookDeliveries(@Req() req: Request & { workspace: WorkspaceActor }) {
    return this.service.webhookDeliveries(req.workspace);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: Request & { workspace: WorkspaceActor }) {
    requireAdmin(req.workspace);
    return this.service.delete(id, req.workspace);
  }

  @Get('connect')
  async connectApp(@Res() res: Response, @Req() req: Request & { workspace: WorkspaceActor }) {
    requireAdmin(req.workspace);
    const appSlug = process.env.GITHUB_APP_SLUG || 'reka-platform';
    const state = await this.service.issueInstallState();
    const cookieName = process.env.NODE_ENV === 'production' ? '__Host-reka_github_install_state' : 'reka_github_install_state';
    res.cookie(cookieName, state, authCookieOptions(10 * 60 * 1000));
    return res.redirect(`https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new?state=${state}`);
  }

  @Get('callback')
  async installCallback(
    @Query('installation_id') installationId: string,
    @Query('state') state: string,
    @Res() res: Response,
    @Req() req: Request & { workspace: WorkspaceActor },
  ) {
    requireAdmin(req.workspace);
    const cookieName = process.env.NODE_ENV === 'production' ? '__Host-reka_github_install_state' : 'reka_github_install_state';
    const expected = req.cookies?.[cookieName];
    res.clearCookie(cookieName, authCookieOptions());
    if (typeof state !== 'string' || !/^[a-fA-F0-9]{64}$/.test(state) || typeof expected !== 'string' ||
        !/^[a-fA-F0-9]{64}$/.test(expected) || state.length !== expected.length ||
        !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) {
      throw new BadRequestException('GitHub installation state expired or invalid');
    }
    await this.service.consumeInstallState(state);
    const parsedId = /^\d{1,16}$/.test(installationId || '') ? Number(installationId) : NaN;
    const webUrl = process.env.WEB_URL || 'http://localhost:5173';
    if (!Number.isSafeInteger(parsedId) || parsedId <= 0) return res.redirect(`${webUrl}/settings?github=verification_failed`);
    try {
      await this.service.recordInstallation(parsedId, req.workspace);
      return res.redirect(`${webUrl}/settings?github=installed`);
    } catch {
      // Keep credential/provider detail out of the browser redirect and report a
      // truthful, actionable generic error in Settings.
      return res.redirect(`${webUrl}/settings?github=verification_failed`);
    }
  }
}
