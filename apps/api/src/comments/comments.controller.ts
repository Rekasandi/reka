import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { CommentsService } from './comments.service';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('by-issue/:issueId')
  findByIssueId(@Param('issueId') issueId: string) {
    return this.commentsService.findByIssueId(issueId);
  }

  @Post('by-issue/:issueId')
  create(
    @Param('issueId') issueId: string,
    @Body('body') body: string,
    @Body('authorId') authorId?: string,
  ) {
    return this.commentsService.create(issueId, body, authorId);
  }
}
