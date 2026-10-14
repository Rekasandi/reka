import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { UpdateIssuesBulkDto } from './dto/update-issues-bulk.dto';
import { CreateIssueRelationDto } from './dto/create-issue-relation.dto';
import { ConfigureIssueRecurrenceDto } from './dto/issue-recurrence.dto';

@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Get()
  findAll(@Req() req: Request & { userId: string }, @Query('status') status?: string, @Query('archived') archived?: string) {
    return this.issuesService.findAll(req.userId, status, archived === 'true');
  }

  @Patch('bulk')
  updateMany(@Req() req: Request & { userId: string }, @Body() dto: UpdateIssuesBulkDto) {
    return this.issuesService.updateMany(dto, req.userId);
  }

  @Post(':id/move-to-top')
  moveToTop(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.issuesService.moveToTop(id, req.userId);
  }

  @Post(':id/archive')
  archive(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.issuesService.archive(id, req.userId);
  }

  @Post(':id/restore')
  restore(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.issuesService.restore(id, req.userId);
  }

  @Get(':id/relations')
  findRelations(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.issuesService.findRelations(id, req.userId);
  }

  @Post(':id/relations')
  addRelation(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: CreateIssueRelationDto) {
    return this.issuesService.addRelation(id, dto, req.userId);
  }

  @Delete(':id/relations/:relatedIssueId')
  removeRelation(@Req() req: Request & { userId: string }, @Param('id') id: string, @Param('relatedIssueId') relatedIssueId: string, @Query('type') type?: string) {
    return this.issuesService.removeRelation(id, relatedIssueId, type ?? '', req.userId);
  }

  @Get(':id/recurrence')
  getRecurrence(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.issuesService.getRecurrence(id, req.userId);
  }

  @Post(':id/recurrence')
  configureRecurrence(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: ConfigureIssueRecurrenceDto) {
    return this.issuesService.configureRecurrence(id, dto, req.userId);
  }

  @Delete(':id/recurrence')
  stopRecurrence(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.issuesService.stopRecurrence(id, req.userId);
  }

  @Get(':id')
  findById(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.issuesService.findById(id, req.userId);
  }

  @Get(':id/subtasks')
  findSubtasks(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.issuesService.findSubtasks(id, req.userId);
  }

  @Get('by-identifier/:identifier')
  findByIdentifier(@Req() req: Request & { userId: string }, @Param('identifier') identifier: string) {
    return this.issuesService.findByIdentifier(identifier, req.userId);
  }

  @Post()
  create(@Req() req: Request & { userId: string }, @Body() dto: CreateIssueDto) {
    return this.issuesService.create(dto, req.userId);
  }

  @Patch(':id')
  update(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: UpdateIssueDto) {
    return this.issuesService.update(id, dto, req.userId);
  }

  @Delete(':id')
  delete(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.issuesService.delete(id, req.userId);
  }
}
