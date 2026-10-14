import { Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { IssueSubscriptionsService } from './issue-subscriptions.service';

@Controller('issues/:issueId/subscription')
export class IssueSubscriptionsController {
  constructor(private readonly subscriptions: IssueSubscriptionsService) {}
  @Get() getState(@Req() req: Request & { userId: string }, @Param('issueId') id: string) { return this.subscriptions.getState(id, req.userId); }
  @Post() subscribe(@Req() req: Request & { userId: string }, @Param('issueId') id: string) { return this.subscriptions.subscribe(id, req.userId); }
  @Delete() unsubscribe(@Req() req: Request & { userId: string }, @Param('issueId') id: string) { return this.subscriptions.unsubscribe(id, req.userId); }
}
