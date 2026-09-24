import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { milestones } from '@reka/database';
import { eq } from 'drizzle-orm';

@Injectable()
export class MilestonesService {
  constructor(private readonly database: DatabaseService) {}

  async findByProjectId(projectId: string) {
    return this.database.db.select().from(milestones).where(eq(milestones.projectId, projectId));
  }
}
