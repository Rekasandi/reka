import { Controller, Get } from '@nestjs/common';
import { GithubInstallationsService } from './installations.service';

@Controller('integrations/github/installations')
export class GithubInstallationsController {
  constructor(private readonly service: GithubInstallationsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
