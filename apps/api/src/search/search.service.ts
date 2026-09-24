import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { issues, projects } from '@reka/database';
import { ilike, or } from 'drizzle-orm';

@Injectable()
export class SearchService {
  constructor(private readonly database: DatabaseService) {}

  async globalSearch(query: string) {
    if (!query) return { issues: [], projects: [] };

    const matchingIssues = await this.database.db
      .select()
      .from(issues)
      .where(or(ilike(issues.title, `%${query}%`), ilike(issues.identifier, `%${query}%`)))
      .limit(10);

    const matchingProjects = await this.database.db
      .select()
      .from(projects)
      .where(ilike(projects.name, `%${query}%`))
      .limit(10);

    return {
      issues: matchingIssues,
      projects: matchingProjects,
    };
  }
}
