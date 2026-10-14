import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createDbClient } from '@reka/database';
import { QUEUES } from '../queues/queue.constants';
import { captureCurrentCycleSnapshots, processDueTeamCycleSchedules } from './cycle-planning';

@Injectable()
export class CyclePlanningProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CyclePlanningProcessor.name);
  private worker?: Worker;
  private queue?: Queue;

  async onModuleInit() {
    const redis = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
      : new Redis({ host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined, maxRetriesPerRequest: null });
    this.queue = new Queue(QUEUES.CYCLE_PLANNING, { connection: redis });
    this.worker = new Worker(QUEUES.CYCLE_PLANNING, async () => {
      const db = createDbClient(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/reka');
      const created = await processDueTeamCycleSchedules(db);
      const snapshots = await captureCurrentCycleSnapshots(db);
      if (created.length) this.logger.log(`Created ${created.length} scheduled cycle(s)`);
      if (snapshots.length) this.logger.log(`Recorded ${snapshots.length} cycle history snapshot(s)`);
      return { created: created.length, snapshots: snapshots.length };
    }, { connection: redis });
    this.worker.on('failed', (job, error) => this.logger.error(`Cycle planning job ${job?.id} failed: ${error.message}`));
    await this.queue.add('plan-cycles-and-capture-history', {}, { repeat: { every: 60_000 }, jobId: 'plan-cycles-and-capture-history', removeOnComplete: true });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
