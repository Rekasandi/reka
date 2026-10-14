import { Module } from '@nestjs/common';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { IssueSubscriptionsModule } from '../issue-subscriptions/issue-subscriptions.module';

@Module({
  imports: [NotificationsModule, IssueSubscriptionsModule],
  controllers: [IssuesController],
  providers: [IssuesService],
  exports: [IssuesService],
})
export class IssuesModule {}
