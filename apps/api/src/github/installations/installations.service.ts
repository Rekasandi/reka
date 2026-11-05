import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../../common/database/database.service';
import { accounts, githubInstallations, githubRepositories, oauthLoginAttempts, webhookEvents } from '@reka/database';
import { and, desc, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { requireAdmin, requireResourceId, type WorkspaceActor } from '../../common/access/workspace-access';
import { createGithubAppJwt, listInstallationRepositories } from '../github-app-token';

@Injectable()
export class GithubInstallationsService {
  private readonly logger = new Logger(GithubInstallationsService.name);

  constructor(private readonly database: DatabaseService) {}

  async issueInstallState() {
    const state = randomBytes(32).toString('hex');
    await this.database.db.delete(oauthLoginAttempts).where(lt(oauthLoginAttempts.expiresAt, new Date()));
    await this.database.db.insert(oauthLoginAttempts).values({
      stateHash: createHash('sha256').update(state).digest('hex'),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    return state;
  }

  async consumeInstallState(state: string) {
    const [attempt] = await this.database.db.delete(oauthLoginAttempts).where(and(
      eq(oauthLoginAttempts.stateHash, createHash('sha256').update(state).digest('hex')),
      gt(oauthLoginAttempts.expiresAt, new Date()),
    )).returning({ stateHash: oauthLoginAttempts.stateHash });
    if (!attempt) throw new BadRequestException('GitHub installation state expired or already used');
  }

  async findAll(actor: WorkspaceActor) {
    let list = await this.database.db.select().from(githubInstallations)
      .where(eq(githubInstallations.organizationId, actor.organizationId));
    if (!list.length && (actor.role === 'owner' || actor.role === 'admin')) {
      await this.discoverExistingInstallations(actor);
      list = await this.database.db.select().from(githubInstallations)
        .where(eq(githubInstallations.organizationId, actor.organizationId));
    }
    const allRepos = list.length
      ? await this.database.db.select().from(githubRepositories)
        .where(inArray(githubRepositories.installationId, list.map(({ id }) => id)))
      : [];
    return list.map((inst) => {
      const repositories = allRepos.filter((repo) => repo.installationId === inst.id);
      return { ...inst, repositories, repositoryCount: repositories.length };
    });
  }

  async discoverExistingInstallations(actor: WorkspaceActor) {
    if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_PRIVATE_KEY) return;
    const [account] = await this.database.db.select({ accessToken: accounts.accessToken })
      .from(accounts).where(and(eq(accounts.userId, actor.userId), eq(accounts.providerId, 'github'))).limit(1);
    if (!account?.accessToken) return;
    try {
      const headers = { Authorization: `Bearer ${account.accessToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'REKA-Platform-App' };
      const [userRes, orgsRes] = await Promise.all([
        fetch('https://api.github.com/user', { headers, signal: AbortSignal.timeout(10000) }),
        fetch('https://api.github.com/user/orgs?per_page=100', { headers, signal: AbortSignal.timeout(10000) }),
      ]);
      const allowedLogins = new Set<string>();
      if (userRes.ok) {
        const u = (await userRes.json()) as { login?: string };
        if (u.login) allowedLogins.add(u.login.toLowerCase());
      }
      if (orgsRes.ok) {
        const orgs = (await orgsRes.json()) as Array<{ login?: string }>;
        if (Array.isArray(orgs)) for (const o of orgs) if (o.login) allowedLogins.add(o.login.toLowerCase());
      }
      if (!allowedLogins.size) return;

      const { appId, jwt } = createGithubAppJwt();
      const appInstRes = await fetch('https://api.github.com/app/installations?per_page=100', {
        headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'REKA-Platform-App' },
        signal: AbortSignal.timeout(10000),
      });
      if (!appInstRes.ok) return;
      const appInstallations = (await appInstRes.json()) as Array<{ id?: number; app_id?: number; account?: { login?: string; type?: string } }>;
      if (!Array.isArray(appInstallations)) return;
      for (const inst of appInstallations) {
        if (!inst.id || String(inst.app_id) !== appId || !inst.account?.login) continue;
        if (!allowedLogins.has(inst.account.login.toLowerCase())) continue;
        const [existing] = await this.database.db.select().from(githubInstallations).where(eq(githubInstallations.installationId, inst.id));
        if (existing) continue;
        const [created] = await this.database.db.insert(githubInstallations).values({
          organizationId: actor.organizationId,
          installationId: inst.id,
          accountLogin: inst.account.login,
          accountType: inst.account.type === 'User' ? 'User' : 'Organization',
        }).returning();
        if (created) await this.syncInstallationRepositories(created);
      }
    } catch {
      // Best-effort discovery when the app was already installed on GitHub.
    }
  }

  async webhookDeliveries(actor: WorkspaceActor) {
    requireAdmin(actor);
    return this.database.db.select({ id: webhookEvents.id, deliveryId: webhookEvents.deliveryId, event: webhookEvents.event,
      processed: webhookEvents.processed, error: webhookEvents.error, createdAt: webhookEvents.createdAt })
      .from(webhookEvents).where(sql`EXISTS (
        SELECT 1 FROM ${githubInstallations} gi
        WHERE gi.organization_id = ${actor.organizationId}
          AND gi.installation_id::text = ${webhookEvents.payload}->'installation'->>'id'
      )`).orderBy(desc(webhookEvents.createdAt)).limit(20);
  }

  async delete(id: string, actor: WorkspaceActor) {
    requireResourceId(id);
    const deleted = await this.database.db.delete(githubInstallations)
      .where(and(eq(githubInstallations.id, id), eq(githubInstallations.organizationId, actor.organizationId)))
      .returning({ id: githubInstallations.id });
    if (!deleted.length) throw new NotFoundException('GitHub installation not found');
    return { success: true };
  }

  async recordInstallation(installationId: number, actor: WorkspaceActor) {
    if (!Number.isSafeInteger(installationId) || installationId <= 0) throw new BadRequestException('Invalid GitHub installation ID');
    const [existing] = await this.database.db.select().from(githubInstallations)
      .where(eq(githubInstallations.installationId, installationId));
    if (existing) {
      if (existing.organizationId !== actor.organizationId) throw new ConflictException('GitHub installation is already linked to another workspace');
      return existing;
    }

    const verified = await this.verifyInstallation(installationId);
    const [created] = await this.database.db.insert(githubInstallations).values({
      organizationId: actor.organizationId,
      installationId,
      accountLogin: verified.accountLogin,
      accountType: verified.accountType,
    }).returning();
    this.logger.log(`Recorded verified GitHub App installation #${installationId} in workspace ${actor.organizationId}`);
    return created;
  }

  async syncInstallationRepositories(installation: typeof githubInstallations.$inferSelect) {
    const remoteRepos = await listInstallationRepositories(installation.installationId);
    // Automatically connect repositories for focused installations (<= 25 repos); larger accounts can pick in Add Repo.
    if (!remoteRepos.length || remoteRepos.length > 25) return;
    for (const repo of remoteRepos) {
      if (!Number.isSafeInteger(repo.id) || repo.id <= 0 || !repo.owner?.login || !repo.name || !repo.full_name) continue;
      await this.database.db.insert(githubRepositories).values({
        installationId: installation.id,
        repoId: repo.id,
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        isPrivate: Boolean(repo.private),
        defaultBranch: repo.default_branch || 'main',
      }).onConflictDoUpdate({
        target: githubRepositories.repoId,
        set: {
          installationId: installation.id,
          owner: repo.owner.login,
          name: repo.name,
          fullName: repo.full_name,
          isPrivate: Boolean(repo.private),
          defaultBranch: repo.default_branch || 'main',
        },
      });
    }
  }

  private async verifyInstallation(installationId: number): Promise<{ accountLogin: string; accountType: 'User' | 'Organization' }> {
    const { appId, jwt } = createGithubAppJwt();
    let response: Response;
    try {
      response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
        headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'REKA-Platform-App' },
      });
    } catch {
      throw new ServiceUnavailableException('Could not verify GitHub App installation');
    }
    if (!response.ok) throw new ServiceUnavailableException('GitHub rejected installation verification');
    const installation = await response.json() as { id?: number; app_id?: number; account?: { login?: string; type?: string } };
    if (installation.id !== installationId || String(installation.app_id) !== appId || !installation.account?.login ||
        !['User', 'Organization'].includes(installation.account.type || '')) {
      throw new BadRequestException('GitHub installation does not belong to this application');
    }
    return { accountLogin: installation.account.login, accountType: installation.account.type as 'User' | 'Organization' };
  }
}
