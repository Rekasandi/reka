import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GithubWebhookProcessor } from './processors/github-webhook.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { ActivityProcessor } from './processors/activity.processor';
import { AutomationProcessor } from './processors/automation.processor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
  ],
  providers: [
    GithubWebhookProcessor,
    NotificationProcessor,
    ActivityProcessor,
    AutomationProcessor,
  ],
})
export class WorkerModule {}
