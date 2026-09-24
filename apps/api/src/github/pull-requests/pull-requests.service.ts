import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { githubPullRequests } from '@reka/database';
import { eq } from 'drizzle-orm';

@Injectable()
export class GithubPullRequestsService {
  constructor(private readonly database: DatabaseService) {}

  async findByIssueId(issueId: string) {
    return this.database.db
      .select()
      .from(githubPullRequests)
      .where(eq(githubPullRequests.issueId, issueId));
  }
}
