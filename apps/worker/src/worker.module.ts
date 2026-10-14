import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GithubWebhookProcessor } from './processors/github-webhook.processor';
import { ActivityProcessor } from './processors/activity.processor';
import { AutomationProcessor } from './processors/automation.processor';
import { IssueRecurrenceProcessor } from './processors/issue-recurrence.processor';
import { CyclePlanningProcessor } from './processors/cycle-planning.processor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
  ],
  providers: [
    GithubWebhookProcessor,
    ActivityProcessor,
    AutomationProcessor,
    IssueRecurrenceProcessor,
    CyclePlanningProcessor,
  ],
})
export class WorkerModule {}
