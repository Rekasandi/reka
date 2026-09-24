import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUES } from '../queues/queue.constants';

@Injectable()
export class ActivityProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ActivityProcessor.name);
  private worker!: Worker;

  onModuleInit() {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker(
      QUEUES.ACTIVITIES,
      async (job: Job) => {
        this.logger.log(`Recording immutable activity ${job.id}`);
        return { success: true };
      },
      { connection: redis },
    );
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
