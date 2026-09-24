import { Controller, Get, Param } from '@nestjs/common';
import { GithubPullRequestsService } from './pull-requests.service';

@Controller('integrations/github/pull-requests')
export class GithubPullRequestsController {
  constructor(private readonly service: GithubPullRequestsService) {}

  @Get('by-issue/:issueId')
  findByIssueId(@Param('issueId') issueId: string) {
    return this.service.findByIssueId(issueId);
  }
}
