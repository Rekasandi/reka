import { Controller, Get, Post, Patch, Delete, Param, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateMilestoneDto, CreateProjectDependencyDto, CreateProjectUpdateDto, UpdateMilestoneDto, UpdateProjectUpdateDto } from './dto/project-workflows.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Req() req: Request & { userId: string }) {
    return this.projectsService.findAll(req.userId);
  }

  @Get(':id')
  findById(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.projectsService.findById(id, req.userId);
  }

  @Get(':id/milestones')
  listMilestones(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.projectsService.listMilestones(id, req.userId);
  }

  @Post(':id/milestones')
  createMilestone(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: CreateMilestoneDto) {
    return this.projectsService.createMilestone(id, dto, req.userId);
  }

  @Patch(':id/milestones/:milestoneId')
  updateMilestone(@Req() req: Request & { userId: string }, @Param('id') id: string, @Param('milestoneId') milestoneId: string, @Body() dto: UpdateMilestoneDto) {
    return this.projectsService.updateMilestone(id, milestoneId, dto, req.userId);
  }

  @Delete(':id/milestones/:milestoneId')
  deleteMilestone(@Req() req: Request & { userId: string }, @Param('id') id: string, @Param('milestoneId') milestoneId: string) {
    return this.projectsService.deleteMilestone(id, milestoneId, req.userId);
  }

  @Post(':id/milestones/:milestoneId/issues/:issueId')
  assignMilestone(@Req() req: Request & { userId: string }, @Param('id') id: string, @Param('milestoneId') milestoneId: string, @Param('issueId') issueId: string) {
    return this.projectsService.setIssueMilestone(id, milestoneId, issueId, req.userId);
  }

  @Delete(':id/milestones/:milestoneId/issues/:issueId')
  unassignMilestone(@Req() req: Request & { userId: string }, @Param('id') id: string, @Param('milestoneId') milestoneId: string, @Param('issueId') issueId: string) {
    return this.projectsService.setIssueMilestone(id, null, issueId, req.userId, milestoneId);
  }

  @Get(':id/dependencies')
  listDependencies(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.projectsService.listDependencies(id, req.userId);
  }

  @Post(':id/dependencies')
  addDependency(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: CreateProjectDependencyDto) {
    return this.projectsService.addDependency(id, dto.dependsOnProjectId, req.userId);
  }

  @Delete(':id/dependencies/:dependsOnProjectId')
  removeDependency(@Req() req: Request & { userId: string }, @Param('id') id: string, @Param('dependsOnProjectId') dependsOnProjectId: string) {
    return this.projectsService.removeDependency(id, dependsOnProjectId, req.userId);
  }

  @Get(':id/update-subscription')
  getUpdateSubscription(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.projectsService.getUpdateSubscription(id, req.userId);
  }

  @Post(':id/update-subscription')
  subscribeToUpdates(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.projectsService.setUpdateSubscription(id, req.userId, true);
  }

  @Delete(':id/update-subscription')
  unsubscribeFromUpdates(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.projectsService.setUpdateSubscription(id, req.userId, false);
  }

  @Get(':id/updates')
  listUpdates(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.projectsService.listUpdates(id, req.userId);
  }

  @Post(':id/updates')
  createUpdate(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: CreateProjectUpdateDto) {
    return this.projectsService.createUpdate(id, dto, req.userId);
  }

  @Patch(':id/updates/:updateId')
  updateUpdate(@Req() req: Request & { userId: string }, @Param('id') id: string, @Param('updateId') updateId: string, @Body() dto: UpdateProjectUpdateDto) {
    return this.projectsService.updateUpdate(id, updateId, dto, req.userId);
  }

  @Get(':id/members')
  findMembers(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.projectsService.findMembers(id, req.userId);
  }

  @Post(':id/members')
  addMember(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body('userId') userId: string) {
    return this.projectsService.addMember(id, userId, req.userId);
  }

  @Delete(':id/members/:userId')
  removeMember(@Req() req: Request & { userId: string }, @Param('id') id: string, @Param('userId') userId: string) {
    return this.projectsService.removeMember(id, userId, req.userId);
  }

  @Get(':id/repositories')
  findRepositories(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.projectsService.findRepositories(id, req.userId);
  }

  @Post(':id/repositories')
  addRepository(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body('repositoryId') repositoryId: string) {
    return this.projectsService.addRepository(id, repositoryId, req.userId);
  }

  @Delete(':id/repositories/:repositoryId')
  removeRepository(@Req() req: Request & { userId: string }, @Param('id') id: string, @Param('repositoryId') repositoryId: string) {
    return this.projectsService.removeRepository(id, repositoryId, req.userId);
  }

  @Post()
  create(@Req() req: Request & { userId: string }, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto, req.userId);
  }

  @Patch(':id')
  update(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto, req.userId);
  }

  @Delete(':id')
  delete(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.projectsService.delete(id, req.userId);
  }
}
