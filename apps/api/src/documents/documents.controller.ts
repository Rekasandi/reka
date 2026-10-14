import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CreateDocumentDto, UpdateDocumentDto } from './dto/documents.dto';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}
  @Get() list(@Req() req: Request & { userId: string }, @Query('projectId') projectId?: string, @Query('teamId') teamId?: string, @Query('includeArchived') includeArchived?: string) {
    return this.documents.list(req.userId, projectId, teamId, includeArchived === 'true');
  }
  @Get(':id') get(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.documents.get(id, req.userId);
  }
  @Post() create(@Req() req: Request & { userId: string }, @Body() dto: CreateDocumentDto) {
    return this.documents.create(req.userId, dto);
  }
  @Patch(':id') update(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.documents.update(id, req.userId, dto);
  }
  @Post(':id/archive') archive(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.documents.archive(id, req.userId);
  }
  @Post(':id/restore') restore(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.documents.restore(id, req.userId);
  }
}
