const { equal, match, rejects } = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { eq, sql } = require('drizzle-orm');
const { activities, DEFAULT_NOTIFICATION_PREFERENCES, githubInstallations, githubPullRequests, githubRepositories, issues, notifications, notificationPreferences, organizationMembers, organizations, teams, teamWorkflowStates, users, webhookEvents } = require('@reka/database');
const { createPersistentPostgres } = require('../../api/test/support/persistent-postgres.cjs');
const { processGithubWebhookDelivery } = require('../dist/processors/github-pr-event');

const createPullRequestPayload = (context, overrides = {}) => ({
  action: overrides.action || 'opened', installation: { id: context.installationId }, repository: { id: context.repositoryId },
  sender: { login: context.senderLogin }, ...(overrides.review ? { review: overrides.review } : {}), ...(overrides.requestedReviewerLogin ? { requested_reviewer: { login: overrides.requestedReviewerLogin } } : {}), pull_request: {
    number: 23, title: 'Make the real workflow reliable', html_url: 'https://github.com/acme/project/pull/23',
    state: 'open', merged: false, head: { ref: `feature/${context.identifier}-workflow` }, ...overrides.pullRequest,
  },
});

test('webhook delivery persists errors, safely retries and applies PR/review/merge transitions exactly once', { timeout: 90_000 }, async () => {
  const postgres = await createPersistentPostgres();
  try {
    const db = postgres.db;
    const marker = randomUUID().replaceAll('-', '').slice(0, 8).toLowerCase();
    const [org] = await db.insert(organizations).values({ name: `Webhook ${marker}`, slug: `webhook-${marker}` }).returning();
    const [sender, assignee, reporter, reviewer] = await db.insert(users).values([
      { name: 'GitHub sender', email: `sender-${marker}@example.test`, githubUsername: `sender-${marker}` },
      { name: 'Issue assignee', email: `assignee-${marker}@example.test` },
      { name: 'Issue reporter', email: `reporter-${marker}@example.test` },
      { name: 'Requested reviewer', email: `reviewer-${marker}@example.test`, githubUsername: `reviewer-${marker}` },
    ]).returning();
    await db.insert(organizationMembers).values([sender, assignee, reporter, reviewer].map(user => ({ organizationId: org.id, userId: user.id, role: 'member' })));
    const teamKey = `W${marker.replace(/[0-9]/g, 'A').toUpperCase()}`;
    const [team] = await db.insert(teams).values({ organizationId: org.id, name: 'Webhook team', key: teamKey }).returning();
    await db.insert(teamWorkflowStates).values([
      { teamId: team.id, key: 'queued', name: 'Queued', category: 'unstarted', color: '#888888', position: 0 },
      { teamId: team.id, key: 'reviewing', name: 'Reviewing', category: 'started', color: '#4488ff', position: 1 },
      { teamId: team.id, key: 'shipped', name: 'Shipped', category: 'completed', color: '#44aa77', position: 2 },
    ]);
    const identifier = `${team.key}-1`;
    const [issue] = await db.insert(issues).values({ identifier, number: 1, title: 'Webhook issue', status: 'todo', teamId: team.id, reporterId: reporter.id, assigneeId: assignee.id }).returning();
    const [installation] = await db.insert(githubInstallations).values({ organizationId: org.id, installationId: Date.now() + 20, accountLogin: 'acme' }).returning();
    const [repository] = await db.insert(githubRepositories).values({ installationId: installation.id, repoId: Date.now() + 21, owner: 'acme', name: 'project', fullName: 'acme/project' }).returning();
    const context = { installationId: installation.installationId, repositoryId: repository.repoId, senderLogin: sender.githubUsername, identifier, reviewerLogin: reviewer.githubUsername };
    const payload = createPullRequestPayload(context);
    const [stored] = await db.insert(webhookEvents).values({ deliveryId: `retry-${marker}`, event: 'pull_request', payload }).returning();

    // Simulate a recoverable DB failure after the issue activity/status update but before PR persistence.
    await db.execute(sql.raw(`ALTER TABLE github_pull_requests ADD CONSTRAINT github_pr_retry_test CHECK (branch_name <> 'feature/${identifier}-workflow')`));
    await rejects(processGithubWebhookDelivery(db, { eventId: stored.id, event: stored.event, payload }));
    const [failed] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, stored.id));
    equal(failed.processed, false);
    match(failed.error, /github_pr_retry_test/);
    await db.execute(sql.raw('ALTER TABLE github_pull_requests DROP CONSTRAINT github_pr_retry_test'));

    await processGithubWebhookDelivery(db, { eventId: stored.id, event: stored.event, payload });
    await processGithubWebhookDelivery(db, { eventId: stored.id, event: stored.event, payload });
    const [completed] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, stored.id));
    equal(completed.processed, true); equal(completed.error, null);
    const [openedIssue] = await db.select().from(issues).where(eq(issues.id, issue.id));
    equal(openedIssue.status, 'reviewing', 'PR-open status follows the team’s active category, not a hardcoded global status');
    equal((await db.select().from(githubPullRequests).where(eq(githubPullRequests.repositoryId, repository.id))).length, 1);
    const openedActivity = (await db.select().from(activities).where(sql`${activities.metadata}->>'webhookEventId' = ${stored.id}`))[0];
    equal(openedActivity.metadata.statusFrom, 'todo'); equal(openedActivity.metadata.statusTo, 'reviewing');
    equal((await db.select().from(notifications).where(sql`${notifications.metadata}->>'webhookEventId' = ${stored.id}`)).length, 2);

    const sendDelivery = async (deliveryId, action, options = {}) => {
      const { requestedReviewerLogin, ...pullRequest } = options;
      const nextPayload = createPullRequestPayload(context, { action, pullRequest,
        ...(requestedReviewerLogin ? { requestedReviewerLogin } : {}) });
      const [event] = await db.insert(webhookEvents).values({ deliveryId, event: 'pull_request', payload: nextPayload }).returning();
      await processGithubWebhookDelivery(db, { eventId: event.id, event: event.event, payload: nextPayload });
      await processGithubWebhookDelivery(db, { eventId: event.id, event: event.event, payload: nextPayload });
      return event;
    };

    const closed = await sendDelivery(`close-${marker}`, 'closed', { state: 'closed', merged: false });
    const [stillActive] = await db.select().from(issues).where(eq(issues.id, issue.id));
    equal(stillActive.status, 'reviewing', 'closing a PR without merge must not complete the issue');
    equal((await db.select().from(notifications).where(sql`${notifications.metadata}->>'webhookEventId' = ${closed.id}`)).length, 2);

    const reviewRequested = await sendDelivery(`review-request-${marker}`, 'review_requested', { requestedReviewerLogin: context.reviewerLogin });
    equal((await db.select().from(notifications).where(sql`${notifications.metadata}->>'webhookEventId' = ${reviewRequested.id}`)).length, 1, 'review requests notify the addressed GitHub identity only');
    const [reviewNotice] = await db.select().from(notifications).where(sql`${notifications.metadata}->>'webhookEventId' = ${reviewRequested.id}`);
    equal(reviewNotice.userId, reviewer.id); equal(reviewNotice.type, 'pr_review_requested');

    const reviewPayload = createPullRequestPayload(context, { action: 'submitted', review: { state: 'approved' } });
    const [reviewEvent] = await db.insert(webhookEvents).values({ deliveryId: `review-${marker}`, event: 'pull_request_review', payload: reviewPayload }).returning();
    await processGithubWebhookDelivery(db, { eventId: reviewEvent.id, event: reviewEvent.event, payload: reviewPayload });
    await processGithubWebhookDelivery(db, { eventId: reviewEvent.id, event: reviewEvent.event, payload: reviewPayload });
    const [pr] = await db.select().from(githubPullRequests).where(eq(githubPullRequests.repositoryId, repository.id));
    equal(pr.reviewStatus, 'approved');
    equal((await db.select().from(notifications).where(sql`${notifications.metadata}->>'webhookEventId' = ${reviewEvent.id}`)).length, 2);

    const changesPayload = createPullRequestPayload(context, { action: 'submitted', review: { state: 'changes_requested' } });
    const [changesEvent] = await db.insert(webhookEvents).values({ deliveryId: `changes-${marker}`, event: 'pull_request_review', payload: changesPayload }).returning();
    await processGithubWebhookDelivery(db, { eventId: changesEvent.id, event: changesEvent.event, payload: changesPayload });
    await processGithubWebhookDelivery(db, { eventId: changesEvent.id, event: changesEvent.event, payload: changesPayload });
    const [afterChanges] = await db.select().from(githubPullRequests).where(eq(githubPullRequests.repositoryId, repository.id));
    equal(afterChanges.reviewStatus, 'changes_requested');
    equal((await db.select().from(notifications).where(sql`${notifications.metadata}->>'webhookEventId' = ${changesEvent.id}`)).length, 2);

    const reopened = await sendDelivery(`reopen-${marker}`, 'reopened');
    equal((await db.select().from(notifications).where(sql`${notifications.metadata}->>'webhookEventId' = ${reopened.id}`)).length, 2, 'reopening an unmerged PR is replay-safe and notifies eligible members');
    const [reopenedPr] = await db.select().from(githubPullRequests).where(eq(githubPullRequests.repositoryId, repository.id));
    equal(reopenedPr.state, 'open');

    await db.insert(notificationPreferences).values({ userId: assignee.id, preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, github: false } });
    const merged = await sendDelivery(`merge-${marker}`, 'closed', { state: 'closed', merged: true });
    const [completedIssue] = await db.select().from(issues).where(eq(issues.id, issue.id));
    equal(completedIssue.status, 'shipped', 'merged PR follows the team’s completed category');
    const mergedActivity = (await db.select().from(activities).where(sql`${activities.metadata}->>'webhookEventId' = ${merged.id}`))[0];
    equal(mergedActivity.metadata.statusFrom, 'reviewing'); equal(mergedActivity.metadata.statusTo, 'shipped');
    equal((await db.select().from(notifications).where(sql`${notifications.metadata}->>'webhookEventId' = ${merged.id}`)).length, 1, 'GitHub preferences suppress only the opted-out recipient');
  } finally {
    await postgres.close();
  }
});
