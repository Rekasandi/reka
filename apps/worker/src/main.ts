import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { createServer } from 'node:http';
import { Redis } from 'ioredis';
import { WorkerModule } from './worker.module';

/** GET /health on WORKER_HEALTH_PORT (default 3100): 200 while Redis answers, since the worker can do nothing without it. */
function startHealthServer(logger: Logger) {
  const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
    : new Redis({ host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT) || 6379, password: process.env.REDIS_PASSWORD || undefined, lazyConnect: true, maxRetriesPerRequest: 1 });
  redis.on('error', () => undefined);
  const server = createServer(async (request, response) => {
    if (request.url !== '/health') { response.writeHead(404).end(); return; }
    const redisOk = await Promise.race([redis.ping().then(() => true, () => false), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000))]);
    response.writeHead(redisOk ? 200 : 503, { 'Content-Type': 'application/json' }).end(JSON.stringify({ status: redisOk ? 'ok' : 'degraded', service: 'reka-worker', redis: redisOk ? 'ok' : 'unreachable' }));
  });
  const port = Number(process.env.WORKER_HEALTH_PORT) || 3100;
  server.on('error', (error) => logger.warn(`Health endpoint unavailable on :${port}: ${error.message}`));
  server.listen(port, () => logger.log(`Health endpoint on http://localhost:${port}/health`));
  return { close: async () => { server.close(); redis.disconnect(); } };
}

async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');
  const app = await NestFactory.createApplicationContext(WorkerModule);

  logger.log('⚙️ REKA BullMQ Worker successfully started and listening for jobs');
  const health = startHealthServer(logger);

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.log('Shutting down BullMQ worker...');
    await health.close();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Worker bootstrap failed:', err);
  process.exit(1);
});
