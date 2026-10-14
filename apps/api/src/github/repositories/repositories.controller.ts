import { Controller, Get, Post, Delete, Param, Body, Req } from '@nestjs/common';
import { GithubRepositoriesService, CreateRepositoryDto } from './repositories.service';
import type { Request } from 'express';
import { sessionToken } from '../../auth/session-cookie';
import { requireAdmin, type WorkspaceActor } from '../../common/access/workspace-access';

@Controller('integrations/github/repositories')
export class GithubRepositoriesController {
  constructor(private readonly service: GithubRepositoriesService) {}

  @Get()
  findAll(@Req() req: Request & { workspace: WorkspaceActor }) {
    return this.service.findAll(req.workspace);
  }

  @Get('available')
  getAvailableRepos(@Req() req: Request & { workspace: WorkspaceActor }) {
    requireAdmin(req.workspace);
    return this.service.getAvailableRepos(sessionToken(req), req.workspace);
  }

  @Post()
  create(@Body() dto: CreateRepositoryDto, @Req() req: Request & { workspace: WorkspaceActor }) {
    requireAdmin(req.workspace);
    return this.service.create(dto, req.workspace, sessionToken(req));
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: Request & { workspace: WorkspaceActor }) {
    requireAdmin(req.workspace);
    return this.service.delete(id, req.workspace);
  }
}
