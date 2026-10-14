import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { WorkspaceActor } from '../common/access/workspace-access';
import { AutomationsService } from './automations.service';

@Controller('automations')
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get()
  findAll(@Req() req: Request & { workspace: WorkspaceActor }) {
    return this.automationsService.findAll(req.workspace);
  }
}
