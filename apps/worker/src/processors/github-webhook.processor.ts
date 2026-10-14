import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUES } from '../queues/queue.constants';
import { createDbClient } from '@reka/database';
import { processGithubWebhookDelivery } from './github-pr-event';

@Injectable()
export class GithubWebhookProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GithubWebhookProcessor.name);
  private worker!: Worker;

  onModuleInit() {
    const redis = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
      : new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: null,
        });

    this.worker = new Worker(QUEUES.GITHUB_WEBHOOKS, (job: Job) => this.processJob(job), { connection: redis });
    this.worker.on('completed', job => this.logger.log(`Job ${job.id} on ${QUEUES.GITHUB_WEBHOOKS} completed`));
    this.worker.on('failed', (job, error) => this.logger.error(`Job ${job?.id} on ${QUEUES.GITHUB_WEBHOOKS} failed: ${error.message}`));
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
  }

  private async processJob(job: Job) {
    const { eventId, event, payload } = job.data;
    this.logger.log(`Processing event: ${event} (Event ID: ${eventId})`);
    const db = createDbClient(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/reka');
    try {
      await processGithubWebhookDelivery(db, { eventId: String(eventId || ''), event: String(event || ''), payload });
    } catch (error) {
      this.logger.error(`Error processing webhook job: ${(error as Error).message}`);
      throw error;
    }
  }
}
