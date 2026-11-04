import { NotificationsModule } from '../notifications/notifications.module';
import { Module } from '@nestjs/common';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './reactions.service';

@Module({
  imports: [NotificationsModule], controllers: [ReactionsController], providers: [ReactionsService] })
export class ReactionsModule {}
