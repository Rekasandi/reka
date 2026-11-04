import { NotificationsModule } from '../notifications/notifications.module';
import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [NotificationsModule], controllers: [AttachmentsController], providers: [AttachmentsService], exports: [AttachmentsService] })
export class AttachmentsModule {}
