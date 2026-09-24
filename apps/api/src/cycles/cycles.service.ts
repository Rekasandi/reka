import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { cycles } from '@reka/database';
import { eq } from 'drizzle-orm';

@Injectable()
export class CyclesService {
  constructor(private readonly database: DatabaseService) {}

  async findByTeamId(teamId: string) {
    return this.database.db.select().from(cycles).where(eq(cycles.teamId, teamId));
  }
}
