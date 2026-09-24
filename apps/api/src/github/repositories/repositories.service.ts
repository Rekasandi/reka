import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { githubRepositories } from '@reka/database';

@Injectable()
export class GithubRepositoriesService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    return this.database.db.select().from(githubRepositories);
  }
}
