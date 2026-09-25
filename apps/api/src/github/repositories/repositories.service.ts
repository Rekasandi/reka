import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { githubRepositories, githubInstallations, organizations } from '@reka/database';
import { eq, desc } from 'drizzle-orm';
import { GITHUB_USER_TOKENS } from '../../auth/auth.service';

export interface CreateRepositoryDto {
  fullName: string; // e.g. "rekasandi/reka" or "facebook/react"
  defaultBranch?: string;
  isPrivate?: boolean;
}

@Injectable()
export class GithubRepositoriesService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    return this.database.db.select().from(githubRepositories).orderBy(desc(githubRepositories.createdAt));
  }

  async getAvailableRepos(sessionToken?: string) {
    // 1. Try to get real GitHub token from user session or GITHUB_TOKEN env
    const userGithubToken = sessionToken ? GITHUB_USER_TOKENS.get(sessionToken) : undefined;
    const token = userGithubToken || process.env.GITHUB_TOKEN;

    if (token) {
      try {
        const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'REKA-Platform-App',
          },
        });
        if (res.ok) {
          const list = (await res.json()) as any[];
          if (Array.isArray(list) && list.length > 0) {
            return list.map((r) => ({
              id: r.id,
              fullName: r.full_name,
              name: r.name,
              owner: r.owner?.login,
              defaultBranch: r.default_branch || 'main',
              isPrivate: r.private,
              description: r.description,
            }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch user repos from GitHub API:', err);
      }
    }

    // 2. If token is not present yet or API rate-limited, query repos already in database
    const existing = await this.database.db.select().from(githubRepositories);
    if (existing.length > 0) {
      return existing.map((r) => ({
        id: r.repoId,
        fullName: r.fullName,
        name: r.name,
        owner: r.owner,
        defaultBranch: r.defaultBranch,
        isPrivate: r.isPrivate,
        description: null,
      }));
    }

    return [];
  }

  async create(dto: CreateRepositoryDto) {
    const parts = dto.fullName.trim().split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('Repository full name must be in "owner/repo" format (e.g. rekasandi/reka)');
    }

    const owner = parts[0].trim();
    const name = parts[1].trim();
    const fullName = `${owner}/${name}`;

    // 1. Check existing repo
    const existing = await this.database.db
      .select()
      .from(githubRepositories)
      .where(eq(githubRepositories.fullName, fullName));

    if (existing.length) {
      throw new ConflictException(`Repository "${fullName}" is already connected`);
    }

    // 2. Ensure installation exists
    let [installation] = await this.database.db.select().from(githubInstallations).limit(1);

    if (!installation) {
      const [org] = await this.database.db.select().from(organizations).limit(1);
      if (!org) throw new NotFoundException('No organization found in workspace');

      const [newInst] = await this.database.db
        .insert(githubInstallations)
        .values({
          organizationId: org.id,
          installationId: Math.floor(100000 + Math.random() * 900000),
          accountLogin: owner,
          accountType: 'Organization',
        })
        .returning();
      installation = newInst;
    }

    // 3. Insert repository
    const [created] = await this.database.db
      .insert(githubRepositories)
      .values({
        installationId: installation.id,
        repoId: Math.floor(1000000 + Math.random() * 9000000),
        owner,
        name,
        fullName,
        isPrivate: dto.isPrivate || false,
        defaultBranch: dto.defaultBranch?.trim() || 'main',
      })
      .returning();

    return created;
  }

  async delete(id: string) {
    await this.database.db.delete(githubRepositories).where(eq(githubRepositories.id, id));
    return { success: true };
  }
}
