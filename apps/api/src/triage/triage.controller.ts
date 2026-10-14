import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TriageService } from './triage.service';
import { CreateIssueTemplateDto } from './dto/issue-template.dto';
import { UpdateIssueTemplateDto } from './dto/update-issue-template.dto';
import { SubmitIssueTemplateDto } from './dto/submit-issue-template.dto';
import { AcceptTriageIssueDto, DeclineTriageIssueDto, DuplicateTriageIssueDto } from './dto/triage-action.dto';

@Controller()
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Get('triage')
  findTriage(@Req() req: Request & { userId: string }, @Query('teamId') teamId?: string) {
    return this.triageService.findTriage(req.userId, teamId);
  }

  @Post('triage/:id/accept')
  accept(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: AcceptTriageIssueDto) {
    return this.triageService.accept(id, dto, req.userId);
  }

  @Post('triage/:id/decline')
  decline(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: DeclineTriageIssueDto) {
    return this.triageService.decline(id, dto, req.userId);
  }

  @Post('triage/:id/duplicate')
  duplicate(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: DuplicateTriageIssueDto) {
    return this.triageService.markDuplicate(id, dto, req.userId);
  }

  @Get('issue-templates')
  findTemplates(@Req() req: Request & { userId: string }, @Query('teamId') teamId?: string) {
    return this.triageService.findTemplates(req.userId, teamId);
  }

  @Post('issue-templates')
  createTemplate(@Req() req: Request & { userId: string }, @Body() dto: CreateIssueTemplateDto) {
    return this.triageService.createTemplate(dto, req.userId);
  }

  @Patch('issue-templates/:id')
  updateTemplate(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: UpdateIssueTemplateDto) {
    return this.triageService.updateTemplate(id, dto, req.userId);
  }

  @Delete('issue-templates/:id')
  deleteTemplate(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.triageService.deleteTemplate(id, req.userId);
  }

  @Post('issue-templates/:id/submit')
  submitTemplate(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: SubmitIssueTemplateDto) {
    return this.triageService.submitTemplate(id, dto, req.userId);
  }
}
