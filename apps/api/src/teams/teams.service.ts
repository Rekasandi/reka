import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { teams } from '@reka/database';
import { eq } from 'drizzle-orm';

@Injectable()
export class TeamsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    return this.database.db.select().from(teams);
  }

  async findById(id: string) {
    const result = await this.database.db.select().from(teams).where(eq(teams.id, id));
    return result[0] || null;
  }
}
