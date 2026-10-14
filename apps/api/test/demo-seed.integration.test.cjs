const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { eq, sql: drizzleSql } = require('drizzle-orm');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');
const schema = require('@reka/database');

// The CLI production-write path is never invoked by this isolated test.
test('demo seeding persists connected fixtures, preserves real work and does not duplicate on rerun', { timeout: 120000 }, async () => {
  const postgres = await createPersistentPostgres();
  const folder = mkdtempSync(join(tmpdir(), 'reka-demo-seed-test-'));
  let api;
  try {
    const [org] = await postgres.db.insert(schema.organizations).values({ name: 'Demo test company', slug: 'demo-test' }).returning();
    const [owner] = await postgres.db.insert(schema.users).values({ name: 'Test owner', email: 'owner@example.test', role: 'owner' }).returning();
    await postgres.db.insert(schema.organizationMembers).values({ organizationId: org.id, userId: owner.id, role: 'owner' });
    const [realTeam] = await postgres.db.insert(schema.teams).values({ name: 'Real team', key: 'REAL', organizationId: org.id }).returning();
    const [realIssue] = await postgres.db.insert(schema.issues).values({ title: 'Preserve this real work', teamId: realTeam.id, reporterId: owner.id, identifier: 'REAL-1', number: 1 }).returning();
    const token = randomUUID();
    await postgres.db.insert(schema.sessions).values({ id: token, userId: owner.id, expiresAt: new Date(Date.now() + 3600000) });
    const modules = ['auth', 'issues', 'teams', 'users', 'clients', 'projects', 'cycles', 'documents', 'initiatives', 'triage', 'views', 'comments', 'attachments', 'notifications', 'labels', 'issue-subscriptions'].map(name => Object.values(require(`../dist/${name}/${name}.module`))[0]);
    api = await createIsolatedApi(postgres, modules);
    const { seedDemo } = await import('../../../scripts/seed-demo.mjs');
    const options = { apiUrl: api.url, token, sql: async (strings, ...values) => (await postgres.db.execute(drizzleSql(strings, ...values))).rows, owner: { id: owner.id, organizationId: org.id }, manifestFile: join(folder, 'manifest.json') };
    const started = new Date();
    const result = await seedDemo(options);
    assert.equal(Object.keys(result.records.teams).length, 3);
    assert.equal(Object.keys(result.records.projects).length, 6);
    assert.equal(Object.keys(result.records.issues).length, 30);
    const check = async () => {
      const issueRows = await postgres.db.select().from(schema.issues);
      assert.equal(issueRows.length, 37, '36 demo issues plus existing real issue');
      assert.deepEqual(issueRows.find(row => row.id === realIssue.id), realIssue);
      const members = await postgres.db.select().from(schema.organizationMembers);
      const profiles = members.filter(row => row.userId !== owner.id);
      assert.equal(profiles.length, 5);
      assert.ok(profiles.every(row => row.admission === 'pending' && !row.isActive));
      const notifications = await postgres.db.select().from(schema.notifications);
      assert.equal(notifications.length, 5);
      assert.ok(notifications.every(row => row.userId === owner.id && row.metadata.demo === true && row.title.startsWith('[DEMO]')));
      const history = await postgres.db.select().from(schema.issueHistory);
      assert.ok(history.filter(row => row.issueId !== realIssue.id).every(row => row.recordedAt >= started), 'no backdated history');
      assert.equal((await postgres.db.select().from(schema.cycleSnapshots)).length, 4);
      assert.equal((await postgres.db.select().from(schema.githubInstallations)).length, 0);
      assert.equal((await postgres.db.select().from(schema.githubPullRequests)).length, 0);
      const [realOwner] = await postgres.db.select().from(schema.organizationMembers).where(eq(schema.organizationMembers.userId, owner.id));
      assert.equal(realOwner.role, 'owner');
    };
    await check();
    await seedDemo(options);
    await check();
    await postgres.reopen();
    await check();
  } finally {
    if (api) await api.close();
    await postgres.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
