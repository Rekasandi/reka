const { deepEqual, equal, ok } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { and, eq, sql } = require('drizzle-orm');
const { activities, githubBranches, githubPullRequests, issues, notifications, organizations, teams, users, organizationMembers, teamMembers, githubInstallations, githubRepositories } = require('@reka/database');
const { createPersistentPostgres } = require('../../api/test/support/persistent-postgres.cjs');
const { processGithubBranchCreatedEvent, processGithubPrEvent, processGithubWebhookEvent } = require('../dist/processors/github-pr-event');

test('GitHub PR notification persists once for its real recipient after a Postgres restart', { timeout: 90_000 }, async () => {
  const postgres = await createPersistentPostgres();
  const marker = randomUUID().replaceAll('-', '').slice(0, 10).toLowerCase();
  const eventId = `delivery-${randomUUID()}`;

  try {
    const db = postgres.db;
    const [org] = await db.insert(organizations).values({ name: `Integration ${marker}`, slug: `integration-${marker}` }).returning();
    const [sender] = await db.insert(users).values({ email: `sender-${marker}@example.test`, name: 'Sender User', githubUsername: `sender-${marker}` }).returning();
    const [recipient] = await db.insert(users).values({ email: `recipient-${marker}@example.test`, name: 'Recipient User', githubUsername: `recipient-${marker}` }).returning();
    await db.insert(organizationMembers).values([
      { organizationId: org.id, userId: sender.id, role: 'member' },
      { organizationId: org.id, userId: recipient.id, role: 'member' },
    ]);
    const [team] = await db.insert(teams).values({ organizationId: org.id, name: `Integration ${marker}`, key: `T${marker.slice(0, 8)}` }).returning();
    const [installation] = await db.insert(githubInstallations).values({ organizationId: org.id, installationId: Date.now(), accountLogin: 'acme' }).returning();
    const [repository] = await db.insert(githubRepositories).values({ installationId: installation.id, repoId: Date.now() + 1, owner: 'acme', name: 'reka', fullName: 'acme/reka' }).returning();
    ok(sender && recipient && team && repository);
    const [issue] = await db.insert(issues).values({
      identifier: `${team.key}-${marker}`,
      number: 1,
      title: `GitHub event ${marker}`,
      status: 'todo',
      type: 'task',
      teamId: team.id,
      reporterId: sender.id,
      assigneeId: recipient.id,
    }).returning();

    const event = {
      eventId,
      installationId: installation.installationId,
      repositoryId: repository.repoId,
      senderLogin: sender.githubUsername,
      issueIdentifiers: [issue.identifier],
      pullRequest: { number: 42, title: `PR ${marker}`, html_url: `https://github.com/acme/reka/pull/42`, state: 'open', merged: false, branchName: `feature/${issue.identifier}` },
      nextStatus: 'in_review',
    };
    await Promise.all([processGithubPrEvent(db, event), processGithubPrEvent(db, event)]);

    await postgres.reopen();
    const persisted = await postgres.db.select().from(notifications).where(and(
      eq(notifications.userId, recipient.id),
      sql`${notifications.metadata}->>'webhookEventId' = ${eventId}`,
      sql`${notifications.metadata}->>'issueId' = ${issue.id}`,
    ));
    equal(persisted.length, 1, 'GitHub webhook retries must not duplicate notifications');
    equal(persisted[0].type, 'status_change');
    equal(persisted[0].metadata.prNumber, 42);
    equal(persisted[0].metadata.issueIdentifier, issue.identifier);

    const eventRecipients = await postgres.db.select({ userId: notifications.userId }).from(notifications).where(
      sql`${notifications.metadata}->>'webhookEventId' = ${eventId}`,
    );
    deepEqual(eventRecipients.map((row) => row.userId), [recipient.id]);
    const [reloadedIssue] = await postgres.db.select().from(issues).where(eq(issues.id, issue.id));
    equal(reloadedIssue.status, 'in_review');
    const persistedPrs = await postgres.db.select().from(githubPullRequests).where(eq(githubPullRequests.repositoryId, repository.id));
    equal(persistedPrs.length, 1, 'worker persists verified PR data idempotently');
    equal(persistedPrs[0].issueId, issue.id);
    equal(persistedPrs[0].branchName, `feature/${issue.identifier}`);
    equal((await postgres.db.select().from(activities).where(eq(activities.issueId, issue.id))).length, 1);
  } finally {
    await postgres.close();
  }
});

test('GitHub branch events transition only same-workspace referenced issues and are replay-safe', { timeout: 90_000 }, async () => {
  const postgres = await createPersistentPostgres();
  try {
    const db = postgres.db;
    const marker = randomUUID().replaceAll('-', '').slice(0, 8).toLowerCase();
    const [org, otherOrg] = await db.insert(organizations).values([
      { name: `Branch ${marker}`, slug: `branch-${marker}` },
      { name: `Foreign ${marker}`, slug: `foreign-${marker}` },
    ]).returning();
    const [sender] = await db.insert(users).values({ name: 'Branch sender', email: `branch-${marker}@example.test`, githubUsername: `branch-${marker}` }).returning();
    await db.insert(organizationMembers).values({ organizationId: org.id, userId: sender.id, role: 'member' });
    const keySuffix = marker.replace(/[0-9]/g, 'A').toUpperCase();
    const [team, foreignTeam] = await db.insert(teams).values([
      { organizationId: org.id, name: 'Branch team', key: `B${keySuffix}` },
      { organizationId: otherOrg.id, name: 'Foreign team', key: `F${keySuffix}` },
    ]).returning();
    const [issue, foreignIssue] = await db.insert(issues).values([
      { identifier: `${team.key}-1`, number: 1, title: 'Branch issue', status: 'todo', teamId: team.id, reporterId: sender.id },
      { identifier: `${foreignTeam.key}-1`, number: 1, title: 'Foreign issue', status: 'todo', teamId: foreignTeam.id, reporterId: sender.id },
    ]).returning();
    const [installation] = await db.insert(githubInstallations).values({ organizationId: org.id, installationId: Date.now() + 7, accountLogin: 'acme' }).returning();
    const [repository] = await db.insert(githubRepositories).values({ installationId: installation.id, repoId: Date.now() + 8, owner: 'acme', name: 'repo', fullName: 'acme/repo' }).returning();
    const event = {
      eventId: `branch-${marker}`, installationId: installation.installationId, repositoryId: repository.repoId,
      branchName: `feature/${issue.identifier}-title`, sha: '1'.repeat(40), issueIdentifiers: [issue.identifier, foreignIssue.identifier],
      senderLogin: sender.githubUsername,
    };
    await Promise.all([processGithubBranchCreatedEvent(db, event), processGithubBranchCreatedEvent(db, event)]);
    const [updated] = await db.select().from(issues).where(eq(issues.id, issue.id));
    const [untouched] = await db.select().from(issues).where(eq(issues.id, foreignIssue.id));
    equal(updated.status, 'in_progress');
    equal(untouched.status, 'todo', 'another workspace issue is never selected by identifier references');
    const events = await db.select().from(activities).where(eq(activities.issueId, issue.id));
    equal(events.length, 1);
    equal(events[0].actorId, sender.id);
    const branches = await db.select().from(githubBranches).where(eq(githubBranches.issueId, issue.id));
    equal(branches.length, 1); equal(branches[0].sha, '1'.repeat(40));
    const githubContext = { installation: { id: installation.installationId }, repository: { id: repository.repoId }, sender: { login: sender.githubUsername } };
    const pushPayload = { ...githubContext, ref: `refs/heads/${event.branchName}`, after: '2'.repeat(40), deleted: false };
    await processGithubWebhookEvent(db, { eventId: `push-${marker}`, event: 'push', payload: pushPayload });
    await processGithubWebhookEvent(db, { eventId: `push-${marker}`, event: 'push', payload: pushPayload });
    const [updatedBranch] = await db.select().from(githubBranches).where(eq(githubBranches.issueId, issue.id));
    equal(updatedBranch.sha, '2'.repeat(40));
    const deletePayload = { ...githubContext, ref: event.branchName, ref_type: 'branch' };
    await processGithubWebhookEvent(db, { eventId: `delete-${marker}`, event: 'delete', payload: deletePayload });
    await processGithubWebhookEvent(db, { eventId: `delete-${marker}`, event: 'delete', payload: deletePayload });
    equal((await db.select().from(githubBranches).where(eq(githubBranches.issueId, issue.id))).length, 0);
    equal((await db.select().from(activities).where(eq(activities.issueId, issue.id))).length, 3, 'create/update/delete each add one replay-safe history event');
  } finally {
    await postgres.close();
  }
});

test('GitHub worker withholds private-team notifications until recipient has explicit membership', { timeout: 90_000 }, async () => {
  const postgres = await createPersistentPostgres();
  try {
    const db = postgres.db;
    const marker = randomUUID().replaceAll('-', '').slice(0, 8).toLowerCase();
    const [org] = await db.insert(organizations).values({ name: `Private ${marker}`, slug: `private-${marker}` }).returning();
    const [sender] = await db.insert(users).values({ email: `sender-${marker}@example.test`, name: 'Sender', githubUsername: `sender-${marker}` }).returning();
    const [recipient] = await db.insert(users).values({ email: `recipient-${marker}@example.test`, name: 'Recipient' }).returning();
    await db.insert(organizationMembers).values([
      { organizationId: org.id, userId: sender.id, role: 'member' },
      { organizationId: org.id, userId: recipient.id, role: 'member' },
    ]);
    const [team] = await db.insert(teams).values({ organizationId: org.id, name: 'Private team', key: `P${marker.toUpperCase()}`, isPrivate: true }).returning();
    const [issue] = await db.insert(issues).values({
      identifier: `${team.key}-1`, number: 1, title: 'Private issue', status: 'todo', teamId: team.id,
      reporterId: sender.id, assigneeId: recipient.id,
    }).returning();
    const [installation] = await db.insert(githubInstallations).values({ organizationId: org.id, installationId: Date.now() + 3, accountLogin: 'acme' }).returning();
    const [repository] = await db.insert(githubRepositories).values({
      installationId: installation.id, repoId: Date.now() + 4, owner: 'acme', name: 'private', fullName: 'acme/private',
    }).returning();
    const base = {
      installationId: installation.installationId, repositoryId: repository.repoId, senderLogin: sender.githubUsername,
      issueIdentifiers: [issue.identifier], pullRequest: { number: 2, title: 'PR', html_url: 'https://github.com/acme/private/pull/2', state: 'open', merged: false, branchName: `feature/${issue.identifier}` },
      nextStatus: 'in_review',
    };
    await processGithubPrEvent(db, { ...base, eventId: 'private-withheld' });
    equal((await db.select().from(notifications).where(sql`${notifications.metadata}->>'webhookEventId' = 'private-withheld'`)).length, 0);
    await db.insert(teamMembers).values({ teamId: team.id, userId: recipient.id, role: 'viewer' });
    await processGithubPrEvent(db, { ...base, eventId: 'private-allowed' });
    const delivered = await db.select().from(notifications).where(and(
      eq(notifications.userId, recipient.id), sql`${notifications.metadata}->>'webhookEventId' = 'private-allowed'`,
    ));
    equal(delivered.length, 1);
    equal(delivered[0].metadata.issueId, issue.id);
  } finally {
    await postgres.close();
  }
});
