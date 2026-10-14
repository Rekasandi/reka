import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AddInitiativeProjectDto, CreateInitiativeDto, UpdateInitiativeDto } from './dto/initiative.dto';
import { InitiativesService } from './initiatives.service';

@Controller('initiatives')
export class InitiativesController {
  constructor(private readonly initiativesService: InitiativesService) {}

  @Get('roadmap')
  roadmap(@Req() req: Request & { userId: string }) { return this.initiativesService.roadmap(req.userId); }

  @Get()
  list(@Req() req: Request & { userId: string }) { return this.initiativesService.list(req.userId); }

  @Post()
  create(@Req() req: Request & { userId: string }, @Body() dto: CreateInitiativeDto) { return this.initiativesService.create(dto, req.userId); }

  @Get(':id')
  findById(@Req() req: Request & { userId: string }, @Param('id') id: string) { return this.initiativesService.findById(id, req.userId); }

  @Patch(':id')
  update(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: UpdateInitiativeDto) { return this.initiativesService.update(id, dto, req.userId); }

  @Delete(':id')
  delete(@Req() req: Request & { userId: string }, @Param('id') id: string) { return this.initiativesService.delete(id, req.userId); }

  @Post(':id/projects')
  addProject(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: AddInitiativeProjectDto) {
    return this.initiativesService.addProject(id, dto.projectId, req.userId);
  }

  @Delete(':id/projects/:projectId')
  removeProject(@Req() req: Request & { userId: string }, @Param('id') id: string, @Param('projectId') projectId: string) {
    return this.initiativesService.removeProject(id, projectId, req.userId);
  }
}
