import { Injectable, NotFoundException, ConflictException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { githubRepositories, githubInstallations } from '@reka/database';
import { and, desc, eq, sql } from 'drizzle-orm';
import { GITHUB_USER_TOKENS } from '../../auth/auth.service';
import { repositoryScope, requireResourceId, type WorkspaceActor } from '../../common/access/workspace-access';

export interface CreateRepositoryDto {
  fullName: string;
  defaultBranch?: string;
  isPrivate?: boolean;
}

@Injectable()
export class GithubRepositoriesService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(actor: WorkspaceActor) {
    return this.database.db.select().from(githubRepositories)
      .where(repositoryScope(this.database.db, actor)).orderBy(desc(githubRepositories.createdAt));
  }

  async getAvailableRepos(sessionToken: string | undefined, actor: WorkspaceActor) {
    const userGithubToken = sessionToken ? GITHUB_USER_TOKENS.get(sessionToken) : undefined;
    const token = userGithubToken || process.env.GITHUB_TOKEN;
    if (token) {
      try {
        const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'REKA-Platform-App' },
        });
        if (res.ok) {
          const list = await res.json() as any[];
          return Array.isArray(list) ? list.map((repo) => ({
            id: repo.id,
            fullName: repo.full_name,
            name: repo.name,
            owner: repo.owner?.login,
            defaultBranch: repo.default_branch || 'main',
            isPrivate: repo.private,
            description: repo.description,
          })) : [];
        }
      } catch {
        // Return only already-connected, workspace-authorized repositories below.
      }
    }
    const existing = await this.database.db.select().from(githubRepositories)
      .where(repositoryScope(this.database.db, actor));
    return existing.map((repo) => ({
      id: repo.repoId, fullName: repo.fullName, name: repo.name, owner: repo.owner,
      defaultBranch: repo.defaultBranch, isPrivate: repo.isPrivate, description: null,
    }));
  }

  async create(dto: CreateRepositoryDto, actor: WorkspaceActor, sessionToken?: string) {
    const fullName = typeof dto.fullName === 'string' ? dto.fullName.trim() : '';
    const match = /^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]{1,100})$/.exec(fullName);
    if (!match || fullName.length > 512) throw new BadRequestException('Repository full name must be in "owner/repo" format');
    if (dto.defaultBranch !== undefined && (typeof dto.defaultBranch !== 'string' || !dto.defaultBranch.trim() || dto.defaultBranch.length > 100)) {
      throw new BadRequestException('Invalid default branch');
    }
    const token = (sessionToken && GITHUB_USER_TOKENS.get(sessionToken)) || process.env.GITHUB_TOKEN;
    if (!token) throw new ServiceUnavailableException('A verified GitHub token is required to connect repositories');

    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'REKA-Platform-App' },
    });
    if (response.status === 404) throw new NotFoundException('Repository is not accessible to the authenticated GitHub account');
    if (!response.ok) throw new ServiceUnavailableException('GitHub repository verification failed');
    const repo = await response.json() as { id: number; full_name: string; name: string; owner: { login: string; type?: string }; default_branch?: string; private: boolean };
    if (!Number.isSafeInteger(repo.id) || repo.id <= 0 || !repo.owner?.login || !repo.name || !repo.full_name) {
      throw new ServiceUnavailableException('GitHub returned an invalid repository record');
    }

    const [installation] = await this.database.db.select().from(githubInstallations).where(and(
      eq(githubInstallations.organizationId, actor.organizationId),
      sql`lower(${githubInstallations.accountLogin}) = lower(${repo.owner.login})`,
    ));
    if (!installation) throw new BadRequestException('Install/connect this GitHub account in the workspace before adding its repositories');

    const [existing] = await this.database.db.select().from(githubRepositories)
      .where(and(eq(githubRepositories.installationId, installation.id), eq(githubRepositories.repoId, repo.id)));
    if (existing) throw new ConflictException(`Repository "${repo.full_name}" is already connected`);

    const [created] = await this.database.db.insert(githubRepositories).values({
      installationId: installation.id,
      repoId: repo.id,
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
      isPrivate: repo.private,
      defaultBranch: repo.default_branch || 'main',
    }).returning();
    return created;
  }

  async delete(id: string, actor: WorkspaceActor) {
    requireResourceId(id);
    const deleted = await this.database.db.delete(githubRepositories)
      .where(and(eq(githubRepositories.id, id), repositoryScope(this.database.db, actor)))
      .returning({ id: githubRepositories.id });
    if (!deleted.length) throw new NotFoundException('GitHub repository not found');
    return { success: true };
  }
}
