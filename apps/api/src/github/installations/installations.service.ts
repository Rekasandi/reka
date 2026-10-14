import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes, sign } from 'node:crypto';
import { DatabaseService } from '../../common/database/database.service';
import { githubInstallations, githubRepositories, oauthLoginAttempts, webhookEvents } from '@reka/database';
import { and, desc, eq, gt, inArray, lt, isNull, sql } from 'drizzle-orm';
import { requireAdmin, requireResourceId, type WorkspaceActor } from '../../common/access/workspace-access';

@Injectable()
export class GithubInstallationsService {
  private readonly logger = new Logger(GithubInstallationsService.name);

  constructor(private readonly database: DatabaseService) {}

  async issueInstallState() {
    const state = randomBytes(32).toString('hex');
    await this.database.db.delete(oauthLoginAttempts).where(lt(oauthLoginAttempts.expiresAt, new Date()));
    await this.database.db.insert(oauthLoginAttempts).values({
      stateHash: createHash('sha256').update(state).digest('hex'),
      invitationHash: null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    return state;
  }

  async consumeInstallState(state: string) {
    const [attempt] = await this.database.db.delete(oauthLoginAttempts).where(and(
      eq(oauthLoginAttempts.stateHash, createHash('sha256').update(state).digest('hex')),
      isNull(oauthLoginAttempts.invitationHash),
      gt(oauthLoginAttempts.expiresAt, new Date()),
    )).returning({ stateHash: oauthLoginAttempts.stateHash });
    if (!attempt) throw new BadRequestException('GitHub installation state expired or already used');
  }

  async findAll(actor: WorkspaceActor) {
    const list = await this.database.db.select().from(githubInstallations)
      .where(eq(githubInstallations.organizationId, actor.organizationId));
    const allRepos = list.length
      ? await this.database.db.select().from(githubRepositories)
        .where(inArray(githubRepositories.installationId, list.map(({ id }) => id)))
      : [];
    return list.map((inst) => {
      const repositories = allRepos.filter((repo) => repo.installationId === inst.id);
      return { ...inst, repositories, repositoryCount: repositories.length };
    });
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

  private async verifyInstallation(installationId: number): Promise<{ accountLogin: string; accountType: 'User' | 'Organization' }> {
    const appId = process.env.GITHUB_APP_ID;
    const rawPrivateKey = process.env.GITHUB_PRIVATE_KEY;
    if (!appId || !rawPrivateKey) throw new ServiceUnavailableException('GitHub App credentials are not configured');
    const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const issuedAt = Math.floor(Date.now() / 1000);
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: issuedAt - 60, exp: issuedAt + 540, iss: appId })}`;
    const jwt = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
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
