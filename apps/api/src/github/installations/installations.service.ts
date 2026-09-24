import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { githubInstallations } from '@reka/database';

@Injectable()
export class GithubInstallationsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    return this.database.db.select().from(githubInstallations);
  }
}
