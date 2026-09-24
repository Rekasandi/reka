import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { clients } from '@reka/database';
import { eq } from 'drizzle-orm';

@Injectable()
export class ClientsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    return this.database.db.select().from(clients);
  }

  async findById(id: string) {
    const result = await this.database.db.select().from(clients).where(eq(clients.id, id));
    return result[0] || null;
  }
}
