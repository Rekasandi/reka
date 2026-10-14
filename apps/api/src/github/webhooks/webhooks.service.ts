import { Injectable, UnauthorizedException, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { webhookEvents } from '@reka/database';
import { eq } from 'drizzle-orm';
import { verifyGithubWebhookSignature } from '@reka/github';
import { Queue } from 'bullmq';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class GithubWebhooksService {
  private readonly logger = new Logger(GithubWebhooksService.name);
  private webhookQueue?: Queue;

  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {
    try {
      this.webhookQueue = new Queue('github-webhooks', {
        connection: this.redis.getClient(),
      });
    } catch {
      this.logger.warn('Failed to initialize github-webhooks queue (Redis may be offline)');
    }
  }

  async handleWebhook(
    deliveryId: string,
    event: string,
    signature: string | undefined,
    payload: unknown,
    rawBody?: Buffer,
  ) {
    if (!/^[A-Za-z0-9-]{1,128}$/.test(deliveryId || '') || !/^[a-z_]{1,64}$/.test(event || '')) {
      throw new BadRequestException('Invalid GitHub webhook headers');
    }
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret || !rawBody || !signature || !verifyGithubWebhookSignature(rawBody, signature, webhookSecret)) {
      throw new UnauthorizedException('Invalid GitHub webhook signature or server configuration');
    }

    const [inserted] = await this.database.db
      .insert(webhookEvents)
      .values({ deliveryId, event, payload })
      .onConflictDoNothing()
      .returning();
    const [storedEvent] = inserted ? [inserted] : await this.database.db.select().from(webhookEvents).where(eq(webhookEvents.deliveryId, deliveryId)).limit(1);
    if (!storedEvent) throw new ServiceUnavailableException('Could not persist GitHub webhook');
    if (!this.webhookQueue) throw new ServiceUnavailableException('GitHub webhook worker queue is unavailable');

    // Keep the durable event row as the recovery source. A GitHub retry can
    // requeue a missing job or retry a retained failed BullMQ job.
    if (!storedEvent.processed) {
      const jobId = `github-${deliveryId}`;
      const existingJob = await this.webhookQueue.getJob(jobId);
      if (existingJob) {
        if (await existingJob.getState() === 'failed') await existingJob.retry('failed');
      } else {
        await this.webhookQueue.add(storedEvent.event, {
          eventId: storedEvent.id,
          deliveryId,
          event: storedEvent.event,
          payload: storedEvent.payload,
        }, { jobId, attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnFail: false });
      }
    }
    return { received: true, eventId: storedEvent.id };
  }
}
