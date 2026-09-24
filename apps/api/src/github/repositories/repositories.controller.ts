import { Controller, Get } from '@nestjs/common';
import { GithubRepositoriesService } from './repositories.service';

@Controller('integrations/github/repositories')
export class GithubRepositoriesController {
  constructor(private readonly service: GithubRepositoriesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
