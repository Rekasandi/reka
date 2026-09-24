import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { organizations } from '@reka/database';
import { eq } from 'drizzle-orm';

@Injectable()
export class OrganizationsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    return this.database.db.select().from(organizations);
  }

  async findById(id: string) {
    const result = await this.database.db.select().from(organizations).where(eq(organizations.id, id));
    return result[0] || null;
  }
}
