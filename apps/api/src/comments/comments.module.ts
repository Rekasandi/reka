import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { IssueSubscriptionsModule } from '../issue-subscriptions/issue-subscriptions.module';

@Module({
  imports: [NotificationsModule, IssueSubscriptionsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}

