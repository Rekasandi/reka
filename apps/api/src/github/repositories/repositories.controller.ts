import { Controller, Get, Post, Delete, Param, Body, Req } from '@nestjs/common';
import { GithubRepositoriesService, CreateRepositoryDto } from './repositories.service';
import type { Request } from 'express';

@Controller('integrations/github/repositories')
export class GithubRepositoriesController {
  constructor(private readonly service: GithubRepositoriesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('available')
  getAvailableRepos(@Req() req: Request) {
    const sessionToken = req.cookies?.reka_session || req.headers.authorization?.replace('Bearer ', '');
    return this.service.getAvailableRepos(sessionToken);
  }

  @Post()
  create(@Body() dto: CreateRepositoryDto) {
    return this.service.create(dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
