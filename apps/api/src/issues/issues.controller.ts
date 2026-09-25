import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';

@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.issuesService.findAll(status);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.issuesService.findById(id);
  }

  @Get(':id/subtasks')
  findSubtasks(@Param('id') id: string) {
    return this.issuesService.findSubtasks(id);
  }

  @Get('by-identifier/:identifier')
  findByIdentifier(@Param('identifier') identifier: string) {
    return this.issuesService.findByIdentifier(identifier);
  }

  @Post()
  create(@Body() dto: CreateIssueDto) {
    return this.issuesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateIssueDto) {
    return this.issuesService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.issuesService.delete(id);
  }
}
