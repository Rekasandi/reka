import { Controller, Get, Post, Param, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { GithubPullRequestsService } from './pull-requests.service';
import { CreateOrLinkPRDto } from './dto/pull-request.dto';
import type { WorkspaceActor } from '../../common/access/workspace-access';
import { sessionToken } from '../../auth/session-cookie';

@Controller('integrations/github/pull-requests')
export class GithubPullRequestsController {
  constructor(private readonly service: GithubPullRequestsService) {}

  @Get('repositories/by-issue/:issueId')
  repositoriesForIssue(@Param('issueId') issueId: string, @Req() req: Request & { workspace: WorkspaceActor }) {
    return this.service.repositoriesForIssue(issueId, req.workspace);
  }

  @Get('branches/by-issue/:issueId')
  branchesByIssueId(@Param('issueId') issueId: string, @Req() req: Request & { workspace: WorkspaceActor }) {
    return this.service.branchesByIssueId(issueId, req.workspace);
  }

  @Get('by-issue/:issueId')
  findByIssueId(@Param('issueId') issueId: string, @Req() req: Request & { workspace: WorkspaceActor }) {
    return this.service.findByIssueId(issueId, req.workspace);
  }

  @Post('link')
  linkPullRequest(@Body() dto: CreateOrLinkPRDto, @Req() req: Request & { workspace: WorkspaceActor }) {
    return this.service.linkPullRequest(dto, req.workspace, sessionToken(req));
  }
}
