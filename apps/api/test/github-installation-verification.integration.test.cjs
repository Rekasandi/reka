const { equal, rejects, ok } = require('node:assert/strict');
const { test } = require('node:test');
const { generateKeyPairSync, verify } = require('node:crypto');
const { randomUUID } = require('node:crypto');
const { organizations } = require('@reka/database');
const { ConflictException, ServiceUnavailableException, BadRequestException } = require('@nestjs/common');
const { GithubInstallationsService } = require('../dist/github/installations/installations.service');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');

test('GitHub installation records require a signed, app-owned API verification and stay workspace-bound', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  const previous = {
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_PRIVATE_KEY,
    fetch: global.fetch,
  };
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  try {
    const [org, otherOrg] = await postgres.db.insert(organizations).values([
      { name: 'Install company', slug: `install-${randomUUID().slice(0, 8)}` },
      { name: 'Other company', slug: `other-install-${randomUUID().slice(0, 8)}` },
    ]).returning();
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_PRIVATE_KEY = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    let calls = 0;
    global.fetch = async (url, init) => {
      calls += 1;
      equal(url, 'https://api.github.com/app/installations/987654');
      const jwt = init.headers.Authorization.replace('Bearer ', '').split('.');
      equal(JSON.parse(Buffer.from(jwt[0], 'base64url')).alg, 'RS256');
      equal(JSON.parse(Buffer.from(jwt[1], 'base64url')).iss, '12345');
      ok(verify('RSA-SHA256', Buffer.from(`${jwt[0]}.${jwt[1]}`), publicKey, Buffer.from(jwt[2], 'base64url')));
      return new Response(JSON.stringify({ id: 987654, app_id: 12345, account: { login: 'Acme', type: 'Organization' } }), { status: 200 });
    };
    const service = new GithubInstallationsService({ get db() { return postgres.db; } });
    const actor = { userId: randomUUID(), organizationId: org.id, role: 'owner' };
    const state = await service.issueInstallState();
    await service.consumeInstallState(state);
    await rejects(service.consumeInstallState(state), BadRequestException, 'installation state can only be consumed once');
    const installation = await service.recordInstallation(987654, actor);
    equal(installation.accountLogin, 'Acme');
    equal(installation.accountType, 'Organization');
    equal(calls, 1);
    equal((await service.recordInstallation(987654, actor)).id, installation.id, 'same-workspace callback is idempotent');
    equal(calls, 1);
    await rejects(service.recordInstallation(987654, { ...actor, organizationId: otherOrg.id }), ConflictException);
    equal(calls, 1);
  } finally {
    if (previous.appId === undefined) delete process.env.GITHUB_APP_ID;
    else process.env.GITHUB_APP_ID = previous.appId;
    if (previous.privateKey === undefined) delete process.env.GITHUB_PRIVATE_KEY;
    else process.env.GITHUB_PRIVATE_KEY = previous.privateKey;
    global.fetch = previous.fetch;
    await postgres.close();
  }
});

test('unconfigured GitHub App credentials cannot create placeholder installations', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  const previousId = process.env.GITHUB_APP_ID;
  const previousKey = process.env.GITHUB_PRIVATE_KEY;
  try {
    const [org] = await postgres.db.insert(organizations).values({ name: 'No app', slug: `no-app-${randomUUID().slice(0, 8)}` }).returning();
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_PRIVATE_KEY;
    const service = new GithubInstallationsService({ get db() { return postgres.db; } });
    await rejects(service.recordInstallation(12, { userId: randomUUID(), organizationId: org.id, role: 'admin' }), ServiceUnavailableException);
    equal((await service.findAll({ userId: randomUUID(), organizationId: org.id, role: 'admin' })).length, 0);
  } finally {
    if (previousId === undefined) delete process.env.GITHUB_APP_ID; else process.env.GITHUB_APP_ID = previousId;
    if (previousKey === undefined) delete process.env.GITHUB_PRIVATE_KEY; else process.env.GITHUB_PRIVATE_KEY = previousKey;
    await postgres.close();
  }
});
