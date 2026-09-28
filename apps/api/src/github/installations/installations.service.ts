import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { githubInstallations, githubRepositories, organizations } from '@reka/database';
import { eq } from 'drizzle-orm';

@Injectable()
export class GithubInstallationsService {
  private readonly logger = new Logger(GithubInstallationsService.name);

  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    const list = await this.database.db.select().from(githubInstallations);
    const allRepos = await this.database.db.select().from(githubRepositories);
    return list.map((inst) => {
      const repos = allRepos.filter((r) => r.installationId === inst.id);
      return {
        ...inst,
        repositories: repos,
        repositoryCount: repos.length,
      };
    });
  }

  async connectOrganization(accountLogin: string, accountType: string = 'Organization') {
    const [org] = await this.database.db.select().from(organizations).limit(1);
    if (!org) throw new NotFoundException('No organization found in workspace');

    const cleanLogin = accountLogin.trim();
    const existing = await this.database.db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.accountLogin, cleanLogin));

    if (existing.length) {
      return existing[0];
    }

    const [created] = await this.database.db
      .insert(githubInstallations)
      .values({
        organizationId: org.id,
        installationId: Math.floor(100000 + Math.random() * 900000),
        accountLogin: cleanLogin,
        accountType: accountType as any,
      })
      .returning();

    this.logger.log(`Connected GitHub Organization/Account ${cleanLogin} (ID: ${created.installationId})`);
    return created;
  }

  async delete(id: string) {
    await this.database.db.delete(githubInstallations).where(eq(githubInstallations.id, id));
    return { success: true };
  }

  async recordInstallation(installationId: number) {
    const [org] = await this.database.db.select().from(organizations).limit(1);
    if (!org) return null;

    const existing = await this.database.db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.installationId, installationId));

    if (existing.length) {
      return existing[0];
    }

    const [created] = await this.database.db
      .insert(githubInstallations)
      .values({
        organizationId: org.id,
        installationId,
        accountLogin: 'github-org',
        accountType: 'Organization',
      })
      .returning();

    this.logger.log(`Recorded new GitHub App installation ID #${installationId}`);
    return created;
  }
}
