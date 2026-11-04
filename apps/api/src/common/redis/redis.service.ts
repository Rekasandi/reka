import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  onModuleInit() {
    this.client = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
      : new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD || undefined,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        });
    this.client.on('error', () => {
      // Graceful error handling: prevent unhandled exceptions when Redis is unreachable
    });
    // Connect up front (ioredis then reconnects on its own) so the *Safe helpers can skip Redis instantly while it is down.
    this.client.connect().catch(() => undefined);
  }

  /** Cache helpers never wait on a connection: when Redis is not ready they behave like a cache miss. */
  private get ready() { return this.client?.status === 'ready'; }

  async getSafe(key: string): Promise<string | null> {
    try {
      if (!this.ready) return null;
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async setSafe(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (!this.ready) return;
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch {
      // Cache write failures should never break the request lifecycle
    }
  }

  async delSafe(key: string): Promise<void> {
    try {
      if (!this.ready) return;
      await this.client.del(key);
    } catch {
      // Ignore cache deletion errors
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  getClient(): Redis {
    return this.client;
  }
}
