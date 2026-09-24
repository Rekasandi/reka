import { Injectable, OnModuleInit } from '@nestjs/common';
import { createDbClient, type DbClient } from '@reka/database';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private dbClient!: DbClient;

  onModuleInit() {
    const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/reka';
    this.dbClient = createDbClient(databaseUrl);
  }

  get db(): DbClient {
    return this.dbClient;
  }
}
