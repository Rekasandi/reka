import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { automationRules } from '@reka/database';

@Injectable()
export class AutomationsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    return this.database.db.select().from(automationRules);
  }
}
