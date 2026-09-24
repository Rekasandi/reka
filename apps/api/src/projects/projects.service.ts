import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { projects } from '@reka/database';
import { eq } from 'drizzle-orm';

@Injectable()
export class ProjectsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    return this.database.db.select().from(projects);
  }

  async findById(id: string) {
    const result = await this.database.db.select().from(projects).where(eq(projects.id, id));
    return result[0] || null;
  }
}
