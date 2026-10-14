import { Module } from '@nestjs/common';
import { IssueSubscriptionsController } from './issue-subscriptions.controller';
import { IssueSubscriptionsService } from './issue-subscriptions.service';

@Module({ controllers: [IssueSubscriptionsController], providers: [IssueSubscriptionsService], exports: [IssueSubscriptionsService] })
export class IssueSubscriptionsModule {}
