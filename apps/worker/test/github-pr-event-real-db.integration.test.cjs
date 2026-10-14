const { deepEqual, equal, ok } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const enabled = process.env.REKA_RUN_NATIVE_INTEGRATION === '1';
const nativeConnectionFile = process.env.REKA_NATIVE_TEST_CONNECTION_FILE;
const nativeMetadataFile = process.env.REKA_NATIVE_TEST_METADATA_FILE;
function getDisposableBranchConnection() {
  if (!nativeConnectionFile || !nativeMetadataFile || !process.env.REKA_NATIVE_TEST_HOST) {
    throw new Error('Native GitHub DB checks require explicit disposable-branch connection and metadata files');
  }
  const connection = readFileSync(nativeConnectionFile, 'utf8').trim();
  const host = new URL(connection).hostname;
  const metadata = JSON.parse(readFileSync(nativeMetadataFile, 'utf8'));
  if (!metadata.branch?.parent_id || metadata.branch.default || metadata.branch.primary ||
      !metadata.branch.expires_at || !metadata.branch.name?.startsWith('reka-access-native') ||
      !metadata.endpoints?.some(endpoint => endpoint.host === host && endpoint.branch_id === metadata.branch.id) ||
      host !== process.env.REKA_NATIVE_TEST_HOST || host.includes('-pooler')) {
    throw new Error('Refusing DB writes without metadata for the explicitly selected expiring non-primary direct Neon child');
  }
  return connection;
}
const databaseUrl = enabled ? getDisposableBranchConnection() : undefined;
const { and, eq, sql } = require('drizzle-orm');
const { createDbClient, issues, notifications, teams, users } = require('@reka/database');
const { processGithubPrEvent } = require('../dist/processors/github-pr-event');

test('GitHub PR event persists one notification for the intended user across a fresh database client', {
  skip: !enabled ? 'Set REKA_RUN_NATIVE_INTEGRATION=1 with disposable child-branch metadata files to run write tests' : false,
  timeout: 60_000,
}, async () => {
  const db = createDbClient(databaseUrl);
  const eventId = `db-integration-${randomUUID()}`;
  let issue;
  let recipientId;

  try {
    const [team] = await db.select().from(teams).limit(1);
    const people = await db.select().from(users).limit(2);
    ok(team, 'test requires an existing team');
    equal(people.length, 2, 'test requires two real users to verify recipient isolation');
    const [sender, recipient] = people;
    recipientId = recipient.id;

    [issue] = await db.insert(issues).values({
      identifier: `${team.key}-${Date.now()}`,
      number: Date.now() % 2_000_000_000,
      title: `GitHub notification integration ${randomUUID().slice(0, 8)}`,
      status: 'todo',
      type: 'task',
      teamId: team.id,
      reporterId: sender.id,
      assigneeId: recipient.id,
    }).returning();

    const event = {
      eventId,
      senderLogin: sender.email.split('@')[0],
      issueIdentifiers: [issue.identifier],
      pullRequest: {
        number: 999999,
        title: 'Integration test PR event',
        html_url: `https://github.com/reka/integration/pull/${Date.now()}`,
      },
      nextStatus: 'in_review',
    };
    await processGithubPrEvent(db, event);
    await processGithubPrEvent(db, event);

    const reloadedDb = createDbClient(databaseUrl);
    const persisted = await reloadedDb.select().from(notifications).where(and(
      eq(notifications.userId, recipient.id),
      sql`${notifications.metadata}->>'webhookEventId' = ${eventId}`,
      sql`${notifications.metadata}->>'issueId' = ${issue.id}`,
    ));
    equal(persisted.length, 1, 'webhook retry must not duplicate the notification');
    equal(persisted[0].type, 'status_change');
    equal(persisted[0].metadata.prNumber, event.pullRequest.number);
    equal(persisted[0].metadata.webhookEventId, eventId);
    equal(persisted[0].metadata.issueIdentifier, issue.identifier);

    const allRecipients = await reloadedDb.select({ userId: notifications.userId }).from(notifications).where(
      sql`${notifications.metadata}->>'webhookEventId' = ${eventId}`,
    );
    deepEqual(allRecipients.map(({ userId }) => userId), [recipient.id]);
    const [updatedIssue] = await reloadedDb.select().from(issues).where(eq(issues.id, issue.id));
    equal(updatedIssue.status, 'in_review');
  } finally {
    if (issue) {
      const cleanupDb = createDbClient(databaseUrl);
      await cleanupDb.delete(notifications).where(and(
        eq(notifications.userId, recipientId),
        sql`${notifications.metadata}->>'webhookEventId' = ${eventId}`,
        sql`${notifications.metadata}->>'issueId' = ${issue.id}`,
      ));
      await cleanupDb.delete(issues).where(eq(issues.id, issue.id));
    }
  }
});
