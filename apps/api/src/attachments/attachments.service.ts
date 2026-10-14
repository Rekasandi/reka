import { Injectable, BadRequestException, ForbiddenException, GoneException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { and, desc, eq } from 'drizzle-orm';
import { activities, attachments } from '@reka/database';
import { DatabaseService } from '../common/database/database.service';
import { requireIssue, requireIssueWrite, requireResourceId, requireTeamManager, requireTeamWrite, requireWorkspace } from '../common/access/workspace-access';

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/markdown']);
export type UploadFile = { buffer: Buffer; size: number; mimetype: string; originalname: string };

export function validateAttachmentFile(file: UploadFile) {
  if (!file?.buffer?.length || file.buffer.length > MAX_ATTACHMENT_BYTES || file.size > MAX_ATTACHMENT_BYTES) {
    throw new BadRequestException('Attachment must be between 1 byte and 5 MiB');
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) throw new BadRequestException('Unsupported attachment type');
  const b = file.buffer;
  const signatureMatches = file.mimetype === 'image/png' ? b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : file.mimetype === 'image/jpeg' ? b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
    : file.mimetype === 'image/gif' ? ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('ascii'))
    : file.mimetype === 'image/webp' ? b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP'
    : file.mimetype === 'application/pdf' ? b.subarray(0, 5).toString('ascii') === '%PDF-'
    : null;
  if (signatureMatches === false) throw new BadRequestException('File contents do not match the declared media type');
  if (signatureMatches === null) {
    try { new TextDecoder('utf-8', { fatal: true }).decode(b); }
    catch { throw new BadRequestException('Text attachments must be valid UTF-8'); }
    if (b.includes(0)) throw new BadRequestException('Text attachments cannot contain binary data');
  }
}

function safeFileName(value: string) {
  const name = basename(value || 'attachment').replace(/[\\/]/g, '_').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255);
  return name || 'attachment';
}

@Injectable()
export class AttachmentsService {
  constructor(private readonly database: DatabaseService) {}

  async list(issueId: string, actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    const issue = await requireIssue(this.database.db, actor, issueId);
    const files = await this.database.db.select({ id: attachments.id, issueId: attachments.issueId, uploaderId: attachments.uploaderId,
      fileName: attachments.fileName, fileSize: attachments.fileSize, mimeType: attachments.mimeType,
      url: attachments.url, createdAt: attachments.createdAt })
      .from(attachments).where(eq(attachments.issueId, issueId)).orderBy(desc(attachments.createdAt)).limit(100);
    let manager = actor.role === 'owner' || actor.role === 'admin';
    if (!manager) { try { await requireTeamManager(this.database.db, actor, issue.teamId); manager = true; } catch { /* Member is not a team manager. */ } }
    return files.map(file => ({ ...file, canDelete: file.uploaderId === actorId || manager }));
  }

  async create(issueId: string, file: UploadFile | undefined, actorId: string) {
    if (!file) throw new BadRequestException('Choose a file to upload');
    validateAttachmentFile(file);
    const actor = await requireWorkspace(this.database.db, actorId);
    const issue = await requireIssueWrite(this.database.db, actor, issueId);
    const id = randomUUID();
    const [saved] = await this.database.db.insert(attachments).values({
      id, issueId: issue.id, uploaderId: actorId, fileName: safeFileName(file.originalname),
      fileSize: file.buffer.length, mimeType: file.mimetype, url: `/api/attachments/${id}/download`, content: file.buffer,
    }).returning({ id: attachments.id, issueId: attachments.issueId, uploaderId: attachments.uploaderId,
      fileName: attachments.fileName, fileSize: attachments.fileSize, mimeType: attachments.mimeType, url: attachments.url, createdAt: attachments.createdAt });
    await this.database.db.insert(activities).values({ actorId, issueId: issue.id, projectId: issue.projectId,
      type: 'issue.attachment_uploaded', metadata: { attachmentId: id, fileName: saved.fileName } });
    return saved;
  }

  async download(id: string, actorId: string) {
    requireResourceId(id);
    const actor = await requireWorkspace(this.database.db, actorId);
    const [file] = await this.database.db.select().from(attachments).where(eq(attachments.id, id));
    if (!file?.issueId) throw new NotFoundException('Attachment not found');
    await requireIssue(this.database.db, actor, file.issueId);
    if (!file.content) throw new GoneException('This legacy attachment has no stored file data');
    return file;
  }

  async delete(id: string, actorId: string) {
    requireResourceId(id);
    const actor = await requireWorkspace(this.database.db, actorId);
    const [file] = await this.database.db.select().from(attachments).where(eq(attachments.id, id));
    if (!file?.issueId) throw new NotFoundException('Attachment not found');
    const issue = await requireIssue(this.database.db, actor, file.issueId);
    await requireTeamWrite(this.database.db, actor, issue.teamId);
    if (file.uploaderId !== actorId) {
      try { await requireTeamManager(this.database.db, actor, issue.teamId); }
      catch (error) {
        if (error instanceof ForbiddenException || error instanceof NotFoundException) throw new ForbiddenException('Only the uploader or a team manager may delete this attachment');
        throw error;
      }
    }
    await this.database.db.delete(attachments).where(eq(attachments.id, id));
    await this.database.db.insert(activities).values({ actorId, issueId: issue.id, projectId: issue.projectId,
      type: 'issue.attachment_deleted', metadata: { attachmentId: id, fileName: file.fileName } });
    return { success: true };
  }
}
