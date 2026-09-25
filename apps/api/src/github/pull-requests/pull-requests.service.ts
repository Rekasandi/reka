import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { githubPullRequests, githubRepositories, issues, activities } from '@reka/database';
import { eq, and } from 'drizzle-orm';

export interface CreateOrLinkPRDto {
  issueId: string;
  prNumber: number;
  title: string;
  state?: string;
  branchName: string;
  htmlUrl: string;
  merged?: boolean;
  ciStatus?: 'pending' | 'success' | 'failure';
  reviewStatus?: 'none' | 'changes_requested' | 'approved';
  deployEnv?: string;
  deployUrl?: string;
  releaseTag?: string;
}

@Injectable()
export class GithubPullRequestsService {
  private readonly logger = new Logger(GithubPullRequestsService.name);

  constructor(private readonly database: DatabaseService) {}

  async findByIssueId(issueId: string) {
    return this.database.db
      .select()
      .from(githubPullRequests)
      .where(eq(githubPullRequests.issueId, issueId));
  }

  async linkPullRequest(dto: CreateOrLinkPRDto) {
    // 1. Resolve or create default repository
    let [repo] = await this.database.db.select().from(githubRepositories).limit(1);

    if (!repo) {
      const [newRepo] = await this.database.db
        .insert(githubRepositories)
        .values({
          installationId: '00000000-0000-0000-0000-000000000000',
          repoId: 10001,
          owner: 'rekasandi',
          name: 'reka',
          fullName: 'rekasandi/reka',
          defaultBranch: 'main',
        })
        .returning();
      repo = newRepo;
    }

    // 2. Check existing PR
    const existing = await this.database.db
      .select()
      .from(githubPullRequests)
      .where(
        and(
          eq(githubPullRequests.repositoryId, repo.id),
          eq(githubPullRequests.prNumber, dto.prNumber),
        ),
      );

    let prRecord;
    if (existing.length) {
      const [updated] = await this.database.db
        .update(githubPullRequests)
        .set({
          issueId: dto.issueId,
          title: dto.title,
          state: dto.state || 'open',
          merged: dto.merged || false,
          branchName: dto.branchName,
          htmlUrl: dto.htmlUrl,
          ciStatus: dto.ciStatus || existing[0].ciStatus,
          reviewStatus: dto.reviewStatus || existing[0].reviewStatus,
          deployEnv: dto.deployEnv || existing[0].deployEnv,
          deployUrl: dto.deployUrl || existing[0].deployUrl,
          releaseTag: dto.releaseTag || existing[0].releaseTag,
          updatedAt: new Date(),
        })
        .where(eq(githubPullRequests.id, existing[0].id))
        .returning();
      prRecord = updated;
    } else {
      const [created] = await this.database.db
        .insert(githubPullRequests)
        .values({
          repositoryId: repo.id,
          issueId: dto.issueId,
          prNumber: dto.prNumber,
          title: dto.title,
          state: dto.state || 'open',
          merged: dto.merged || false,
          branchName: dto.branchName,
          htmlUrl: dto.htmlUrl,
          ciStatus: dto.ciStatus || 'success',
          reviewStatus: dto.reviewStatus || 'approved',
          deployEnv: dto.deployEnv || 'preview',
          deployUrl: dto.deployUrl || 'https://reka-preview.vercel.app',
          releaseTag: dto.releaseTag || null,
        })
        .returning();
      prRecord = created;
    }

    // 3. Automation: When PR is linked or opened, update issue status to 'in_review'
    if (dto.issueId && !dto.merged) {
      await this.database.db
        .update(issues)
        .set({ status: 'in_review', updatedAt: new Date() })
        .where(eq(issues.id, dto.issueId));

      await this.database.db.insert(activities).values({
        issueId: dto.issueId,
        type: 'github.pr_opened',
        metadata: {
          prNumber: dto.prNumber,
          title: dto.title,
          htmlUrl: dto.htmlUrl,
        },
      });
    }

    // 4. Automation: When PR is merged, auto-close issue to 'done'
    if (dto.issueId && dto.merged) {
      await this.database.db
        .update(issues)
        .set({ status: 'done', updatedAt: new Date() })
        .where(eq(issues.id, dto.issueId));

      await this.database.db.insert(activities).values({
        issueId: dto.issueId,
        type: 'github.pr_merged',
        metadata: {
          prNumber: dto.prNumber,
          title: dto.title,
          htmlUrl: dto.htmlUrl,
        },
      });
    }

    return prRecord;
  }

  async syncFromBranch(branchName: string, issueIdentifier: string) {
    const match = branchName.match(/([A-Z0-9]+-\d+)/i);
    if (!match) return null;

    const identifier = match[1].toUpperCase();
    const [issue] = await this.database.db.select().from(issues).where(eq(issues.identifier, identifier));
    if (!issue) return null;

    if (issue.status === 'todo' || issue.status === 'backlog') {
      await this.database.db
        .update(issues)
        .set({ status: 'in_progress', updatedAt: new Date() })
        .where(eq(issues.id, issue.id));

      await this.database.db.insert(activities).values({
        issueId: issue.id,
        type: 'github.branch_created',
        metadata: { branchName },
      });
    }

    return issue;
  }
}
