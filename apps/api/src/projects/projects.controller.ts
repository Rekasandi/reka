import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.projectsService.findById(id);
  }

  @Get(':id/repositories')
  findRepositories(@Param('id') id: string) {
    return this.projectsService.findRepositories(id);
  }

  @Post(':id/repositories')
  addRepository(@Param('id') id: string, @Body('repositoryId') repositoryId: string) {
    return this.projectsService.addRepository(id, repositoryId);
  }

  @Delete(':id/repositories/:repositoryId')
  removeRepository(@Param('id') id: string, @Param('repositoryId') repositoryId: string) {
    return this.projectsService.removeRepository(id, repositoryId);
  }

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.projectsService.delete(id);
  }
}
