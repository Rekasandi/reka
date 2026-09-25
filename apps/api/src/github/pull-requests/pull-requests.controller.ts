import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { GithubPullRequestsService, CreateOrLinkPRDto } from './pull-requests.service';

@Controller('integrations/github/pull-requests')
export class GithubPullRequestsController {
  constructor(private readonly service: GithubPullRequestsService) {}

  @Get('by-issue/:issueId')
  findByIssueId(@Param('issueId') issueId: string) {
    return this.service.findByIssueId(issueId);
  }

  @Post('link')
  linkPullRequest(@Body() dto: CreateOrLinkPRDto) {
    return this.service.linkPullRequest(dto);
  }

  @Post('sync-branch')
  syncBranch(@Body('branchName') branchName: string, @Body('issueIdentifier') issueIdentifier: string) {
    return this.service.syncFromBranch(branchName, issueIdentifier);
  }
}
