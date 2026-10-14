const { equal, rejects } = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { test } = require('node:test');
const { eq } = require('drizzle-orm');
const { webhookEvents } = require('@reka/database');
const { UnauthorizedException, ServiceUnavailableException, BadRequestException } = require('@nestjs/common');
const { GithubWebhooksService } = require('../dist/github/webhooks/webhooks.service');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');
const { GithubModule } = require('../dist/github/github.module');
const { RedisModule } = require('../dist/common/redis/redis.module');
const { RedisService } = require('../dist/common/redis/redis.service');

const sign = (body, secret) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

test('GitHub webhook requires configured secret and validates the exact raw request bytes before persistence', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  const originalSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const service = new GithubWebhooksService({ get db() { return postgres.db; } }, { getClient() { throw new Error('Redis intentionally unavailable in this signature test'); } });
  const raw = Buffer.from('{\n  "action": "opened", "padding": "  "\n}');
  const payload = { action: 'opened', padding: '  ' };
  try {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    await rejects(service.handleWebhook('delivery-a', 'pull_request', sign(raw, 'test-secret'), payload, raw), UnauthorizedException, 'missing server secret must fail closed');
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    await rejects(service.handleWebhook('delivery-a', 'pull_request', sign(JSON.stringify(payload), 'test-secret'), payload, raw), UnauthorizedException);
    await rejects(service.handleWebhook('delivery-a', 'pull_request', 'sha256=x', payload, raw), UnauthorizedException);
    await rejects(service.handleWebhook('delivery-a', 'pull_request', sign(raw, 'test-secret'), payload), UnauthorizedException);
    equal((await postgres.db.select().from(webhookEvents)).length, 0, 'invalid or missing raw-body signatures are never persisted');

    await rejects(service.handleWebhook('delivery-a', 'pull_request', sign(raw, 'test-secret'), payload, raw), ServiceUnavailableException,
      'valid event persists, but unavailable worker queue returns retryable failure');
    const [persisted] = await postgres.db.select().from(webhookEvents).where(eq(webhookEvents.deliveryId, 'delivery-a'));
    equal(persisted.event, 'pull_request');
    equal(persisted.payload.padding, '  ');
    equal((await postgres.db.select().from(webhookEvents)).length, 1);
  } finally {
    if (originalSecret === undefined) delete process.env.GITHUB_WEBHOOK_SECRET;
    else process.env.GITHUB_WEBHOOK_SECRET = originalSecret;
    await postgres.close();
  }
});

test('Nest captures and verifies the exact webhook request body before persistence', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  const previousSecret = process.env.GITHUB_WEBHOOK_SECRET;
  let api;
  try {
    process.env.GITHUB_WEBHOOK_SECRET = 'raw-http-secret';
    api = await createIsolatedApi(postgres, [GithubModule, RedisModule], [[RedisService, { getClient() { throw new Error('Redis intentionally unavailable'); } }]]);
    const raw = Buffer.from('{\n  "action": "opened", "body": " whitespace must stay exact "\n}');
    const payload = { action: 'opened', body: ' whitespace must stay exact ' };
    const send = (signature) => fetch(`${api.url}/api/integrations/github/webhook`, {
      method: 'POST', headers: {
        'Content-Type': 'application/json', 'x-github-delivery': 'http-raw-body',
        'x-github-event': 'pull_request', 'x-hub-signature-256': signature,
      }, body: raw,
    });
    equal((await send(sign(JSON.stringify(payload), 'raw-http-secret'))).status, 401, 'a signature over reserialized JSON is rejected');
    equal((await postgres.db.select().from(webhookEvents)).length, 0);
    equal((await send(sign(raw, 'raw-http-secret'))).status, 503, 'valid signature reaches persistence; unavailable worker returns retryable error');
    const [stored] = await postgres.db.select().from(webhookEvents).where(eq(webhookEvents.deliveryId, 'http-raw-body'));
    equal(stored.payload.body, payload.body);
    equal((await postgres.db.select().from(webhookEvents)).length, 1);
  } finally {
    if (api) await api.close();
    if (previousSecret === undefined) delete process.env.GITHUB_WEBHOOK_SECRET;
    else process.env.GITHUB_WEBHOOK_SECRET = previousSecret;
    await postgres.close();
  }
});

test('persisted webhook deliveries reuse pending jobs and recover retained failures without duplication', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  const previousSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const raw = Buffer.from('{ "action": "opened" }');
  const payload = { action: 'opened' };
  const calls = { add: 0, retry: 0 };
  const jobs = new Map();
  try {
    process.env.GITHUB_WEBHOOK_SECRET = 'queue-recovery-secret';
    const service = new GithubWebhooksService({ get db() { return postgres.db; } }, { getClient() { throw new Error('Redis intentionally unavailable at construction'); } });
    service.webhookQueue = {
      getJob: async (id) => jobs.get(id),
      add: async (name, data, options) => {
        calls.add += 1;
        equal(options.attempts, 5);
        const job = { state: 'waiting', async getState() { return this.state; }, async retry(state) { equal(state, 'failed'); calls.retry += 1; this.state = 'waiting'; } };
        jobs.set(options.jobId, job);
        return job;
      },
    };
    const signature = sign(raw, process.env.GITHUB_WEBHOOK_SECRET);
    await service.handleWebhook('delivery-queue', 'pull_request', signature, payload, raw);
    await service.handleWebhook('delivery-queue', 'pull_request', signature, payload, raw);
    equal(calls.add, 1, 'duplicate delivery does not create another pending job');
    jobs.get('github-delivery-queue').state = 'failed';
    await service.handleWebhook('delivery-queue', 'pull_request', signature, payload, raw);
    equal(calls.retry, 1, 'duplicate delivery requeues a retained failed job');
    const [stored] = await postgres.db.select().from(webhookEvents).where(eq(webhookEvents.deliveryId, 'delivery-queue'));
    await postgres.db.update(webhookEvents).set({ processed: true }).where(eq(webhookEvents.id, stored.id));
    await service.handleWebhook('delivery-queue', 'pull_request', signature, payload, raw);
    equal(calls.add, 1);
    equal(calls.retry, 1, 'processed event is not re-enqueued');
  } finally {
    if (previousSecret === undefined) delete process.env.GITHUB_WEBHOOK_SECRET;
    else process.env.GITHUB_WEBHOOK_SECRET = previousSecret;
    await postgres.close();
  }
});

test('GitHub webhook headers reject invalid values without database access', async () => {
  const service = new GithubWebhooksService({ get db() { throw new Error('Should not query database'); } }, { getClient() { throw new Error('Redis intentionally unavailable'); } });
  await rejects(service.handleWebhook('', 'pull_request', 'x', {}, Buffer.from('{}')), BadRequestException);
});
