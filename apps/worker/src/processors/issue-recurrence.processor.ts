import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createDbClient } from '@reka/database';
import { QUEUES } from '../queues/queue.constants';
import { processDueIssueRecurrences } from './issue-recurrence';

@Injectable()
export class IssueRecurrenceProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IssueRecurrenceProcessor.name);
  private worker?: Worker;
  private queue?: Queue;

  async onModuleInit() {
    const redis = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
      : new Redis({ host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined, maxRetriesPerRequest: null });
    this.queue = new Queue(QUEUES.ISSUE_RECURRENCES, { connection: redis });
    this.worker = new Worker(QUEUES.ISSUE_RECURRENCES, async () => {
      const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/reka';
      const created = await processDueIssueRecurrences(createDbClient(databaseUrl));
      if (created.length) this.logger.log(`Generated ${created.length} recurring issue(s)`);
      return { created: created.length };
    }, { connection: redis });
    this.worker.on('failed', (job, error) => this.logger.error(`Recurrence job ${job?.id} failed: ${error.message}`));
    await this.queue.add('generate-due-issues', {}, { repeat: { every: 60_000 }, jobId: 'generate-due-issues', removeOnComplete: true });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
