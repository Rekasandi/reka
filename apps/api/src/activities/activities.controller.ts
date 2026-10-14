import { Controller, Get, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ActivitiesService } from './activities.service';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  findAll(@Req() req: Request & { userId: string }) {
    return this.activitiesService.findAll(req.userId);
  }

  @Get('by-issue/:issueId')
  findByIssueId(@Req() req: Request & { userId: string }, @Param('issueId') issueId: string) {
    return this.activitiesService.findByIssueId(issueId, req.userId);
  }
}
