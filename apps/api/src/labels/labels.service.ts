import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { labels } from '@reka/database';

@Injectable()
export class LabelsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    return this.database.db.select().from(labels);
  }
}
