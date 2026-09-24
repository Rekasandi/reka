import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { users } from '@reka/database';
import { eq } from 'drizzle-orm';

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    return this.database.db.select().from(users);
  }

  async findById(id: string) {
    const result = await this.database.db.select().from(users).where(eq(users.id, id));
    return result[0] || null;
  }
}
