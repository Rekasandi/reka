import { Controller, Get, Post, Patch, Delete, Param, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('by-issue/:issueId')
  findByIssueId(@Req() req: Request & { userId: string }, @Param('issueId') issueId: string) {
    return this.commentsService.findByIssueId(issueId, req.userId);
  }

  @Post('by-issue/:issueId')
  create(@Req() req: Request & { userId: string }, @Param('issueId') issueId: string, @Body() dto: CreateCommentDto) {
    return this.commentsService.create(issueId, dto.body, req.userId);
  }

  @Patch(':id')
  update(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: UpdateCommentDto) {
    return this.commentsService.update(id, dto.body, req.userId);
  }

  @Delete(':id')
  delete(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.commentsService.delete(id, req.userId);
  }
}
