import { Controller, Get, Param } from '@nestjs/common';
import { ActivitiesService } from './activities.service';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('by-issue/:issueId')
  findByIssueId(@Param('issueId') issueId: string) {
    return this.activitiesService.findByIssueId(issueId);
  }
}
