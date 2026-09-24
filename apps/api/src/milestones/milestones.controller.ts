import { Controller, Get, Param } from '@nestjs/common';
import { MilestonesService } from './milestones.service';

@Controller('milestones')
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Get('by-project/:projectId')
  findByProjectId(@Param('projectId') projectId: string) {
    return this.milestonesService.findByProjectId(projectId);
  }
}
