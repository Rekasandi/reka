import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUES } from '../queues/queue.constants';
import { parseIssueIdentifiers } from '@reka/github';
import { createDbClient } from '@reka/database';
import { issues, webhookEvents } from '@reka/database';
import { eq } from 'drizzle-orm';

@Injectable()
export class GithubWebhookProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GithubWebhookProcessor.name);
  private worker!: Worker;

  onModuleInit() {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker(
      QUEUES.GITHUB_WEBHOOKS,
      async (job: Job) => {
        return this.processJob(job);
      },
      { connection: redis },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} on ${QUEUES.GITHUB_WEBHOOKS} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} on ${QUEUES.GITHUB_WEBHOOKS} failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }

  private async processJob(job: Job) {
    const { eventId, event, payload } = job.data;
    this.logger.log(`Processing event: ${event} (Event ID: ${eventId})`);

    const db = createDbClient(
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/reka',
    );

    try {
      if (event === 'pull_request') {
        const action = payload.action;
        const pr = payload.pull_request;
        const branchName = pr.head.ref;
        const title = pr.title;

        // Parse issue references like "RS-123"
        const refs = [
          ...parseIssueIdentifiers(branchName),
          ...parseIssueIdentifiers(title),
        ];

        if (action === 'closed' && pr.merged) {
          for (const ref of refs) {
            this.logger.log(`PR merged! Moving issue ${ref.raw} to done`);
            await db
              .update(issues)
              .set({ status: 'done', updatedAt: new Date() })
              .where(eq(issues.identifier, ref.raw));
          }
        } else if (action === 'opened') {
          for (const ref of refs) {
            this.logger.log(`PR opened! Moving issue ${ref.raw} to in_review`);
            await db
              .update(issues)
              .set({ status: 'in_review', updatedAt: new Date() })
              .where(eq(issues.identifier, ref.raw));
          }
        }
      }

      // Mark webhook event processed
      if (eventId) {
        await db
          .update(webhookEvents)
          .set({ processed: true })
          .where(eq(webhookEvents.id, eventId));
      }
    } catch (error) {
      this.logger.error(`Error processing webhook job: ${(error as Error).message}`);
      if (eventId) {
        await db
          .update(webhookEvents)
          .set({ error: (error as Error).message })
          .where(eq(webhookEvents.id, eventId));
      }
      throw error;
    }
  }
}
