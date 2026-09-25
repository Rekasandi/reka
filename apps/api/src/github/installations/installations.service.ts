import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { githubInstallations, organizations } from '@reka/database';
import { eq } from 'drizzle-orm';

@Injectable()
export class GithubInstallationsService {
  private readonly logger = new Logger(GithubInstallationsService.name);

  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    return this.database.db.select().from(githubInstallations);
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
