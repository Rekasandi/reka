import { Injectable, NotFoundException, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { activities, githubBranches, githubPullRequests, githubRepositories, issueSubscriptions, issues, projectRepositories, teamWorkflowStates } from '@reka/database';
import { DatabaseService } from '../../common/database/database.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { GITHUB_USER_TOKENS } from '../../auth/auth.service';
import { repositoryScope, requireIssue, requireIssueWrite, type WorkspaceActor } from '../../common/access/workspace-access';
import type { CreateOrLinkPRDto } from './dto/pull-request.dto';

@Injectable()
export class GithubPullRequestsService {
  constructor(private readonly database: DatabaseService, private readonly notifications: NotificationsService) {}

  async repositoriesForIssue(issueId: string, actor: WorkspaceActor) {
    const issue = await requireIssue(this.database.db, actor, issueId);
    if (!issue.projectId) return this.database.db.select().from(githubRepositories).where(repositoryScope(this.database.db, actor));
    const linked = await this.database.db.select({ repository: githubRepositories }).from(projectRepositories)
      .innerJoin(githubRepositories, eq(projectRepositories.repositoryId, githubRepositories.id))
      .where(and(eq(projectRepositories.projectId, issue.projectId), repositoryScope(this.database.db, actor)));
    return linked.map(({ repository }) => repository);
  }

  async findByIssueId(issueId: string, actor: WorkspaceActor) {
    await requireIssue(this.database.db, actor, issueId);
    return this.database.db.select({ pullRequest: githubPullRequests }).from(githubPullRequests)
      .innerJoin(githubRepositories, eq(githubPullRequests.repositoryId, githubRepositories.id))
      .where(and(eq(githubPullRequests.issueId, issueId), repositoryScope(this.database.db, actor)))
      .then(rows => rows.map(({ pullRequest }) => pullRequest));
  }

  async branchesByIssueId(issueId: string, actor: WorkspaceActor) {
    await requireIssue(this.database.db, actor, issueId);
    return this.database.db.select({ branch: githubBranches, repositoryName: githubRepositories.fullName }).from(githubBranches)
      .innerJoin(githubRepositories, eq(githubBranches.repositoryId, githubRepositories.id))
      .where(and(eq(githubBranches.issueId, issueId), repositoryScope(this.database.db, actor)))
      .then(rows => rows.map(({ branch, repositoryName }) => ({ ...branch, repositoryName })));
  }

  private async statusForTeam(teamId: string, target: 'in_review' | 'done') {
    const states = await this.database.db.select({ key: teamWorkflowStates.key, category: teamWorkflowStates.category })
      .from(teamWorkflowStates).where(eq(teamWorkflowStates.teamId, teamId));
    const category = target === 'done' ? 'completed' : 'started';
    const preferred = target === 'done' ? ['done'] : ['in_review', 'in_progress'];
    return states.find(state => preferred.includes(state.key) && state.category === category)?.key
      ?? states.find(state => state.category === category)?.key
      ?? (target === 'done' ? 'done' : 'in_review');
  }

  private async notifyIssueRecipients(issue: typeof issues.$inferSelect, actorId: string, dto: { type: 'status_change' | 'pr_merged' | 'pr_closed'; number: number; title: string; url: string }) {
    const subscribers = await this.database.db.select({ userId: issueSubscriptions.userId }).from(issueSubscriptions)
      .where(eq(issueSubscriptions.issueId, issue.id));
    const recipientIds = [...new Set([issue.assigneeId, issue.reporterId, ...subscribers.map(row => row.userId)]
      .filter((id): id is string => Boolean(id && id !== actorId)))];
    for (const userId of recipientIds) {
      try {
        await this.notifications.createForEvent(userId, {
          type: dto.type,
          title: dto.type === 'pr_merged' ? `PR #${dto.number} merged for ${issue.identifier}`
            : dto.type === 'pr_closed' ? `PR #${dto.number} closed without merge for ${issue.identifier}`
            : `${issue.identifier} moved to In Review`,
          body: dto.type === 'pr_merged' ? `Pull request "${dto.title}" was merged.`
            : dto.type === 'pr_closed' ? `Pull request "${dto.title}" was closed without merging. The issue was not marked complete.`
            : `Pull request "${dto.title}" was opened and moved this issue to In Review.`,
          link: '/issues', metadata: { issueId: issue.id, issueIdentifier: issue.identifier, prNumber: dto.number, prTitle: dto.title, externalUrl: dto.url },
        });
      } catch { /* Persisted PR linking must not be undone by notification failure. */ }
    }
  }

  async linkPullRequest(dto: CreateOrLinkPRDto, actor: WorkspaceActor, sessionToken?: string) {
    const issue = await requireIssueWrite(this.database.db, actor, dto.issueId);
    const allowedRepositories = await this.repositoriesForIssue(dto.issueId, actor);
    const repo = allowedRepositories.find(candidate => candidate.id === dto.repositoryId);
    if (!repo) throw new NotFoundException('Repository is not linked to this issue or is not accessible');

    const token = (sessionToken && GITHUB_USER_TOKENS.get(sessionToken)) || process.env.GITHUB_TOKEN;
    if (!token) throw new ServiceUnavailableException('A verified GitHub token is required to verify pull requests');
    let response: Response;
    try {
      response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/pulls/${dto.prNumber}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'REKA-Platform-App' },
        signal: AbortSignal.timeout(15000),
      });
    } catch { throw new ServiceUnavailableException('Could not verify the pull request with GitHub'); }
    if (response.status === 404) throw new NotFoundException('Pull request was not found in the selected repository');
    if (!response.ok) throw new ServiceUnavailableException('GitHub pull request verification failed');
    const pr = await response.json() as { number: number; title: string; state: string; merged: boolean; html_url: string; head?: { ref?: string }; base?: { repo?: { id?: number } } };
    if (pr.number !== dto.prNumber || pr.base?.repo?.id !== repo.repoId || !pr.title || pr.title.length > 512 || !pr.head?.ref || pr.head.ref.length > 255 || !pr.html_url?.startsWith('https://github.com/')) {
      throw new BadRequestException('GitHub returned a pull request that does not belong to the selected repository');
    }
    const merged = pr.merged === true;
    const state = pr.state === 'closed' ? 'closed' : 'open';
    const [existing] = await this.database.db.select().from(githubPullRequests).where(and(
      eq(githubPullRequests.repositoryId, repo.id), eq(githubPullRequests.prNumber, pr.number),
    )).limit(1);
    if (existing?.issueId && existing.issueId !== issue.id) await requireIssueWrite(this.database.db, actor, existing.issueId);
    const changed = !existing || existing.issueId !== issue.id || existing.title !== pr.title || existing.state !== state || existing.merged !== merged || existing.branchName !== pr.head.ref;
    const [record] = await this.database.db.insert(githubPullRequests).values({
      repositoryId: repo.id, issueId: issue.id, prNumber: pr.number, title: pr.title, state, merged,
      branchName: pr.head.ref, htmlUrl: pr.html_url, ciStatus: existing?.ciStatus ?? 'pending', reviewStatus: existing?.reviewStatus ?? 'none',
    }).onConflictDoUpdate({ target: [githubPullRequests.repositoryId, githubPullRequests.prNumber], set: {
      issueId: issue.id, title: pr.title, state, merged, branchName: pr.head.ref, htmlUrl: pr.html_url, updatedAt: new Date(),
    } }).returning();
    if (!record) throw new ServiceUnavailableException('Failed to persist the verified pull request');

    const nextStatus = merged ? await this.statusForTeam(issue.teamId, 'done') : state === 'open' ? await this.statusForTeam(issue.teamId, 'in_review') : null;
    const statusChanged = nextStatus !== null && nextStatus !== issue.status;
    if (statusChanged) await this.database.db.update(issues).set({ status: nextStatus, updatedAt: new Date() }).where(eq(issues.id, issue.id));
    const shouldNotify = changed || statusChanged;
    if (shouldNotify) {
      const type = merged ? 'pr_merged' : state === 'closed' ? 'pr_closed' : 'status_change';
      await this.database.db.insert(activities).values({ actorId: actor.userId, issueId: issue.id,
        type: type === 'pr_merged' ? 'github.pr_merged' : type === 'pr_closed' ? 'github.pr_closed' : 'github.pr_opened',
        metadata: { prNumber: pr.number, title: pr.title, htmlUrl: pr.html_url,
          ...(statusChanged ? { statusFrom: issue.status, statusTo: nextStatus } : {}) },
      });
      await this.notifyIssueRecipients(issue, actor.userId, { type, number: pr.number, title: pr.title, url: pr.html_url });
    }
    return record;
  }
}
