import { Controller, Get, Param, Res, Query } from '@nestjs/common';
import { GithubInstallationsService } from './installations.service';
import type { Response } from 'express';

@Controller('integrations/github/installations')
export class GithubInstallationsController {
  constructor(private readonly service: GithubInstallationsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('connect')
  connectApp(@Res() res: Response) {
    const appSlug = process.env.GITHUB_APP_SLUG || 'reka-platform';
    // Linear-style: Redirect directly to GitHub App installation page
    const installUrl = `https://github.com/apps/${appSlug}/installations/new`;
    return res.redirect(installUrl);
  }

  @Get('callback')
  async installCallback(
    @Query('installation_id') installationId: string,
    @Res() res: Response,
  ) {
    const webUrl = process.env.WEB_URL || 'http://localhost:5173';
    if (installationId) {
      await this.service.recordInstallation(parseInt(installationId, 10));
    }
    return res.redirect(`${webUrl}/settings?github=installed`);
  }
}
