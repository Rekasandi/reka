import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { webhookEvents } from '@reka/database';
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

  async handleWebhook(deliveryId: string, event: string, signature: string | undefined, payload: any) {
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const isValid = verifyGithubWebhookSignature(JSON.stringify(payload), signature, webhookSecret);
      if (!isValid) {
        throw new UnauthorizedException('Invalid GitHub webhook signature');
      }
    }

    // Persist event idempotently
    const [storedEvent] = await this.database.db
      .insert(webhookEvents)
      .values({
        deliveryId,
        event,
        payload,
      })
      .onConflictDoNothing()
      .returning();

    // Enqueue to BullMQ worker if available
    if (storedEvent && this.webhookQueue) {
      await this.webhookQueue.add(event, {
        eventId: storedEvent.id,
        deliveryId,
        event,
        payload,
      });
    }

    return { received: true, eventId: storedEvent?.id };
  }
}
