import { Controller, Delete, Get, Param, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { AttachmentsService, MAX_ATTACHMENT_BYTES, type UploadFile } from './attachments.service';

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get('by-issue/:issueId')
  list(@Req() req: Request & { userId: string }, @Param('issueId') issueId: string) {
    return this.attachments.list(issueId, req.userId);
  }

  @Post('by-issue/:issueId')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 } }))
  create(@Req() req: Request & { userId: string }, @Param('issueId') issueId: string, @UploadedFile() file?: UploadFile) {
    return this.attachments.create(issueId, file, req.userId);
  }

  @Get(':id/download')
  async download(@Req() req: Request & { userId: string }, @Param('id') id: string, @Res() response: Response) {
    const file = await this.attachments.download(id, req.userId);
    const name = file.fileName.replace(/[^\p{L}\p{N}._ ()-]/gu, '_').slice(0, 180) || 'attachment';
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('Content-Length', String(file.content!.length));
    response.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(file.content);
  }

  @Delete(':id')
  delete(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.attachments.delete(id, req.userId);
  }
}
