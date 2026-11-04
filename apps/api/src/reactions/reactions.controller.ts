import { Body, Controller, Get, Param, Put, Req, UseInterceptors } from '@nestjs/common';
import { LiveIssuesInterceptor } from '../notifications/live-issues.interceptor';
import type { Request } from 'express';
import { ReactionsService } from './reactions.service';
import { ToggleReactionDto } from './dto/reaction.dto';

@UseInterceptors(LiveIssuesInterceptor)
@Controller('reactions')
export class ReactionsController {
  constructor(private readonly reactions: ReactionsService) {}

  @Get('by-issue/:issueId')
  findByIssue(@Req() req: Request & { userId: string }, @Param('issueId') issueId: string) {
    return this.reactions.findByIssue(issueId, req.userId);
  }

  @Put('toggle')
  toggle(@Req() req: Request & { userId: string }, @Body() dto: ToggleReactionDto) {
    return this.reactions.toggle(dto, req.userId);
  }
}
