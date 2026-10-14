import { and, asc, eq, sql } from 'drizzle-orm';
import {
  activities, githubBranches, githubInstallations, githubPullRequests, githubRepositories, webhookEvents,
  issues, notifications, notificationPreferences, organizationMembers, teamMembers,
  teamWorkflowStates, teams, users, DEFAULT_NOTIFICATION_PREFERENCES,
} from '@reka/database';
import { parseIssueIdentifiers } from '@reka/github';
import { buildGithubPrNotification, getGithubPrRecipients } from './github-pr-notification';

type ReviewStatus = 'none' | 'approved' | 'changes_requested';
type PrNotice = 'status_change' | 'pr_review_requested' | 'pr_approved' | 'pr_changes_requested' | 'pr_closed' | 'pr_merged';
type PrStatusTarget = 'in_review' | 'done' | null;

async function githubScope(db: any, installationId: number, repositoryId: number) {
  if (!Number.isSafeInteger(installationId) || installationId <= 0 || !Number.isSafeInteger(repositoryId) || repositoryId <= 0) return null;
  const [scope] = await db.select({ organizationId: githubInstallations.organizationId, repositoryId: githubRepositories.id })
    .from(githubInstallations).innerJoin(githubRepositories, eq(githubRepositories.installationId, githubInstallations.id))
    .where(and(eq(githubInstallations.installationId, installationId), eq(githubRepositories.repoId, repositoryId))).limit(1);
  return scope ?? null;
}

async function resolveSender(db: any, organizationId: string, login?: string) {
  const normalized = login?.trim().toLowerCase();
  if (!normalized) return null;
  const [sender] = await db.select({ id: users.id }).from(users).innerJoin(organizationMembers, eq(organizationMembers.userId, users.id))
    .where(and(sql`lower(${users.githubUsername}) = ${normalized}`, eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.isActive, true))).limit(1);
  return sender?.id ?? null;
}

async function resolveIssue(db: any, organizationId: string, identifier: string) {
  const [row] = await db.select({ issue: issues }).from(issues).innerJoin(teams, eq(teams.id, issues.teamId))
    .where(and(eq(issues.identifier, identifier), eq(teams.organizationId, organizationId))).limit(1);
  return row?.issue ?? null;
}

async function statusForTeam(db: any, teamId: string, target: Exclude<PrStatusTarget, null> | 'branch') {
  const states = await db.select({ key: teamWorkflowStates.key, category: teamWorkflowStates.category })
    .from(teamWorkflowStates).where(eq(teamWorkflowStates.teamId, teamId)).orderBy(asc(teamWorkflowStates.position));
  const category = target === 'done' ? 'completed' : 'started';
  const preferred = target === 'done' ? ['done'] : target === 'in_review' ? ['in_review', 'in_progress'] : ['in_progress'];
  return states.find((state: any) => preferred.includes(state.key) && state.category === category)?.key ?? states.find((state: any) => state.category === category)?.key ??
    (category === 'completed' ? 'done' : target === 'in_review' ? 'in_review' : 'in_progress');
}

function activeNotificationPreference(type: PrNotice, preferences: Record<string, boolean>) {
  const key = type === 'status_change' ? 'issueUpdates' : 'github';
  return (preferences as any)?.[key] ?? DEFAULT_NOTIFICATION_PREFERENCES[key];
}

export async function processGithubBranchCreatedEvent(
  db: any,
  input: { eventId?: string; installationId: number; repositoryId: number; branchName: string; sha: string; issueIdentifiers: string[]; senderLogin?: string },
) {
  if (!input.branchName || input.branchName.length > 255 || !/^[0-9a-f]{40}$/i.test(input.sha || '')) return;
  const scope = await githubScope(db, input.installationId, input.repositoryId);
  if (!scope) return;
  const senderId = await resolveSender(db, scope.organizationId, input.senderLogin);
  for (const identifier of [...new Set(input.issueIdentifiers)]) {
    const issue = await resolveIssue(db, scope.organizationId, identifier);
    if (!issue) continue;
    const [createdBranch] = await db.insert(githubBranches).values({ repositoryId: scope.repositoryId, issueId: issue.id, name: input.branchName, sha: input.sha })
      .onConflictDoNothing({ target: [githubBranches.repositoryId, githubBranches.issueId, githubBranches.name] }).returning({ id: githubBranches.id });
    if (!createdBranch) await db.update(githubBranches).set({ sha: input.sha })
      .where(and(eq(githubBranches.repositoryId, scope.repositoryId), eq(githubBranches.issueId, issue.id), eq(githubBranches.name, input.branchName)));
    const currentCategory = (await db.select({ category: teamWorkflowStates.category }).from(teamWorkflowStates)
      .where(and(eq(teamWorkflowStates.teamId, issue.teamId), eq(teamWorkflowStates.key, issue.status))).limit(1))[0]?.category;
    const isPending = currentCategory ? currentCategory === 'backlog' || currentCategory === 'unstarted' : issue.status === 'todo' || issue.status === 'backlog';
    const targetStatus = await statusForTeam(db, issue.teamId, 'branch');
    const [updated] = isPending ? await db.update(issues).set({ status: targetStatus, updatedAt: new Date() })
      .where(and(eq(issues.id, issue.id), eq(issues.status, issue.status))).returning({ id: issues.id }) : [];
    const activityType = 'github.branch_created';
    if (!input.eventId || !updated) {
      if (!input.eventId) continue;
    }
    if (input.eventId) await db.insert(activities).values({
      actorId: senderId, issueId: issue.id, type: createdBranch ? activityType : 'github.branch_updated',
      metadata: { branchName: input.branchName, sha: input.sha, repositoryId: input.repositoryId, webhookEventId: input.eventId,
        ...(updated ? { statusFrom: issue.status, statusTo: targetStatus } : {}) },
    }).onConflictDoNothing();
  }
}

export async function processGithubBranchDeletedEvent(db: any, input: { eventId?: string; installationId: number; repositoryId: number; branchName: string; senderLogin?: string }) {
  const scope = await githubScope(db, input.installationId, input.repositoryId);
  if (!scope || !input.branchName) return;
  const senderId = await resolveSender(db, scope.organizationId, input.senderLogin);
  const linked = await db.select({ issueId: githubBranches.issueId }).from(githubBranches).innerJoin(issues, eq(issues.id, githubBranches.issueId))
    .innerJoin(teams, eq(teams.id, issues.teamId)).where(and(eq(githubBranches.repositoryId, scope.repositoryId), eq(githubBranches.name, input.branchName), eq(teams.organizationId, scope.organizationId)));
  if (input.eventId) for (const { issueId } of linked) await db.insert(activities).values({
    actorId: senderId, issueId, type: 'github.branch_deleted',
    metadata: { branchName: input.branchName, repositoryId: input.repositoryId, webhookEventId: input.eventId },
  }).onConflictDoNothing();
  await db.delete(githubBranches).where(and(eq(githubBranches.repositoryId, scope.repositoryId), eq(githubBranches.name, input.branchName)));
}

export async function processGithubPrEvent(
  db: any,
  input: {
    eventId: string; installationId: number; repositoryId: number; senderLogin: string; issueIdentifiers: string[];
    pullRequest: { number: number; title: string; html_url: string; state: 'open' | 'closed'; merged: boolean; branchName: string };
    nextStatus: PrStatusTarget; reviewStatus?: ReviewStatus; noticeType?: PrNotice;
    requestedReviewerLogin?: string;
  },
) {
  if (!input.eventId || !Number.isSafeInteger(input.pullRequest.number) || input.pullRequest.number <= 0 ||
      !input.pullRequest.title || input.pullRequest.title.length > 512 || !input.pullRequest.branchName ||
      input.pullRequest.branchName.length > 255 || !input.pullRequest.html_url?.startsWith('https://github.com/')) return;
  const scope = await githubScope(db, input.installationId, input.repositoryId);
  if (!scope) return;
  const senderId = await resolveSender(db, scope.organizationId, input.senderLogin);
  const [existingPr] = await db.select().from(githubPullRequests).where(and(
    eq(githubPullRequests.repositoryId, scope.repositoryId), eq(githubPullRequests.prNumber, input.pullRequest.number),
  )).limit(1);
  // An existing association is authoritative; a later title/body reference cannot retarget a PR.
  let issue = existingPr?.issueId ? await resolveIssueById(db, scope.organizationId, existingPr.issueId) : null;
  if (!existingPr?.issueId) {
    for (const identifier of [...new Set(input.issueIdentifiers)]) {
      issue = await resolveIssue(db, scope.organizationId, identifier);
      if (issue) break;
    }
  }
  if (!issue) return;

  let statusTransition: { from: string; to: string } | undefined;
  if (input.nextStatus) {
    const targetStatus = await statusForTeam(db, issue.teamId, input.nextStatus);
    if (issue.status !== targetStatus) {
      await db.update(issues).set({ status: targetStatus, updatedAt: new Date() }).where(eq(issues.id, issue.id));
      statusTransition = { from: issue.status, to: targetStatus };
    }
  }
  const noticeType = input.noticeType ?? (input.nextStatus === 'done' ? 'pr_merged' : input.nextStatus === 'in_review' ? 'status_change' : null);
  const activityType = noticeType === 'pr_merged' ? 'github.pr_merged'
    : noticeType === 'pr_closed' ? 'github.pr_closed'
    : noticeType === 'pr_approved' ? 'github.pr_review_approved'
    : noticeType === 'pr_changes_requested' ? 'github.pr_review_changes_requested'
    : noticeType === 'pr_review_requested' ? 'github.pr_review_requested'
    : noticeType === 'status_change' ? 'github.pr_opened' : null;
  if (activityType) await db.insert(activities).values({ actorId: senderId, issueId: issue.id, type: activityType,
    metadata: { prNumber: input.pullRequest.number, title: input.pullRequest.title, htmlUrl: input.pullRequest.html_url, webhookEventId: input.eventId,
      ...(statusTransition ? { statusFrom: statusTransition.from, statusTo: statusTransition.to } : {}) },
  }).onConflictDoNothing();

  const prValues = {
    repositoryId: scope.repositoryId, issueId: issue.id, prNumber: input.pullRequest.number, title: input.pullRequest.title,
    state: input.pullRequest.state, merged: input.pullRequest.merged, branchName: input.pullRequest.branchName, htmlUrl: input.pullRequest.html_url,
    ...(input.reviewStatus ? { reviewStatus: input.reviewStatus } : {}), updatedAt: new Date(),
  };
  await db.insert(githubPullRequests).values(prValues).onConflictDoUpdate({
    target: [githubPullRequests.repositoryId, githubPullRequests.prNumber],
    set: { title: prValues.title, state: prValues.state, merged: prValues.merged, branchName: prValues.branchName, htmlUrl: prValues.htmlUrl,
      ...(input.reviewStatus ? { reviewStatus: input.reviewStatus } : {}), updatedAt: prValues.updatedAt },
  });

  if (!noticeType) return;
  const reviewers = input.requestedReviewerLogin ? await db.select({ id: users.id }).from(users)
    .innerJoin(organizationMembers, eq(organizationMembers.userId, users.id))
    .where(and(sql`lower(${users.githubUsername}) = ${input.requestedReviewerLogin.trim().toLowerCase()}`,
      eq(organizationMembers.organizationId, scope.organizationId), eq(organizationMembers.isActive, true))).limit(1) : [];
  const candidates: string[] = noticeType === 'pr_review_requested'
    ? reviewers.map((row: any) => String(row.id))
    : getGithubPrRecipients(issue.assigneeId, issue.reporterId, senderId);
  const notification = buildGithubPrNotification(issue, input.pullRequest, input.eventId, noticeType);
  for (const userId of [...new Set(candidates.filter(id => id !== senderId))]) {
    const [membership] = await db.select({ userId: organizationMembers.userId }).from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, scope.organizationId), eq(organizationMembers.userId, userId), eq(organizationMembers.isActive, true))).limit(1);
    if (!membership) continue;
    const [teamMembership] = await db.select({ userId: teamMembers.userId }).from(teamMembers)
      .where(and(eq(teamMembers.teamId, issue.teamId), eq(teamMembers.userId, userId))).limit(1);
    if (!teamMembership && (await db.select({ isPrivate: teams.isPrivate }).from(teams).where(eq(teams.id, issue.teamId)).limit(1))[0]?.isPrivate) continue;
    const [saved] = await db.select({ preferences: notificationPreferences.preferences }).from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId)).limit(1);
    if (!activeNotificationPreference(noticeType, saved?.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES)) continue;
    await db.insert(notifications).values({ userId, ...notification }).onConflictDoNothing();
  }
}

async function resolveIssueById(db: any, organizationId: string, issueId: string) {
  const [row] = await db.select({ issue: issues }).from(issues).innerJoin(teams, eq(teams.id, issues.teamId))
    .where(and(eq(issues.id, issueId), eq(teams.organizationId, organizationId))).limit(1);
  return row?.issue ?? null;
}

export async function processGithubWebhookEvent(db: any, input: { eventId: string; event: string; payload: any }) {
  const payload = input.payload;
  if (!payload || typeof payload !== 'object') return;
  if ((input.event === 'create' || input.event === 'delete') && payload.ref_type === 'branch' && typeof payload.ref === 'string') {
    const installationId = Number(payload.installation?.id); const repositoryId = Number(payload.repository?.id);
    if (input.event === 'delete') return processGithubBranchDeletedEvent(db, { eventId: input.eventId, installationId, repositoryId, branchName: payload.ref, senderLogin: String(payload.sender?.login || '') });
    // GitHub's create event does not include the branch head SHA; the first push below is authoritative.
    const sha = String(payload.after || '');
    if (!/^[0-9a-f]{40}$/i.test(sha)) return;
    const issueIdentifiers = parseIssueIdentifiers(payload.ref).map(({ raw }) => raw);
    return processGithubBranchCreatedEvent(db, { eventId: input.eventId, installationId, repositoryId, branchName: payload.ref,
      sha, issueIdentifiers, senderLogin: String(payload.sender?.login || '') });
  }
  if (input.event === 'push' && typeof payload.ref === 'string' && payload.ref.startsWith('refs/heads/')) {
    const branchName = payload.ref.slice('refs/heads/'.length);
    const installationId = Number(payload.installation?.id); const repositoryId = Number(payload.repository?.id);
    if (payload.deleted === true) return processGithubBranchDeletedEvent(db, { eventId: input.eventId, installationId, repositoryId, branchName, senderLogin: String(payload.sender?.login || '') });
    const sha = String(payload.after || '');
    if (!/^[0-9a-f]{40}$/i.test(sha)) return;
    const issueIdentifiers = parseIssueIdentifiers(branchName).map(({ raw }) => raw);
    return processGithubBranchCreatedEvent(db, { eventId: input.eventId, installationId, repositoryId, branchName,
      sha, issueIdentifiers, senderLogin: String(payload.sender?.login || '') });
  }
  if (input.event !== 'pull_request' && input.event !== 'pull_request_review') return;
  const pr = payload.pull_request;
  if (!pr || typeof pr !== 'object') return;
  const identifiers = [...new Set([...parseIssueIdentifiers(String(pr.head?.ref || '')), ...parseIssueIdentifiers(String(pr.title || ''))].map(({ raw }) => raw))];
  let nextStatus: PrStatusTarget = null; let noticeType: PrNotice | undefined; let reviewStatus: ReviewStatus | undefined;
  let reviewerLogin: string | undefined;
  if (input.event === 'pull_request') {
    if (payload.action === 'opened' || payload.action === 'reopened') { nextStatus = 'in_review'; noticeType = 'status_change'; }
    else if (payload.action === 'closed' && pr.merged === true) { nextStatus = 'done'; noticeType = 'pr_merged'; }
    else if (payload.action === 'closed') noticeType = 'pr_closed';
    else if (payload.action === 'review_requested') { noticeType = 'pr_review_requested'; reviewerLogin = payload.requested_reviewer?.login; }
  } else if (payload.action === 'submitted' || payload.action === 'edited' || payload.action === 'dismissed') {
    const state = String(payload.review?.state || '').toLowerCase();
    if (state === 'approved' && payload.action !== 'dismissed') { reviewStatus = 'approved'; noticeType = payload.action === 'submitted' ? 'pr_approved' : undefined; }
    else if (state === 'changes_requested' && payload.action !== 'dismissed') { reviewStatus = 'changes_requested'; noticeType = payload.action === 'submitted' ? 'pr_changes_requested' : undefined; }
    else if (payload.action === 'dismissed') reviewStatus = 'none';
  }
  const updateOnly = input.event === 'pull_request' && ['edited', 'synchronize', 'ready_for_review', 'converted_to_draft', 'review_request_removed'].includes(String(payload.action));
  if (!noticeType && !nextStatus && reviewStatus === undefined && !updateOnly) return;
  return processGithubPrEvent(db, {
    eventId: input.eventId, installationId: Number(payload.installation?.id), repositoryId: Number(payload.repository?.id),
    senderLogin: String(payload.sender?.login || ''), issueIdentifiers: identifiers,
    pullRequest: { number: Number(pr.number), title: String(pr.title || ''), html_url: String(pr.html_url || ''),
      state: pr.state === 'closed' ? 'closed' : 'open', merged: pr.merged === true, branchName: String(pr.head?.ref || '') },
    nextStatus, noticeType, reviewStatus, requestedReviewerLogin: reviewerLogin,
  });
}

export async function processGithubWebhookDelivery(db: any, input: { eventId: string; event: string; payload: any }) {
  try {
    await processGithubWebhookEvent(db, input);
    if (input.eventId) await db.update(webhookEvents).set({ processed: true, error: null }).where(eq(webhookEvents.id, input.eventId));
  } catch (error) {
    if (input.eventId) {
      await db.update(webhookEvents).set({ error: (error as Error).message.slice(0, 2000) }).where(eq(webhookEvents.id, input.eventId));
    }
    throw error;
  }
}
