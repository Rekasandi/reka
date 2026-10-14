import { Controller, Get, Post, Patch, Delete, Param, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TeamsService } from './teams.service';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto, UpdateTeamMemberDto } from './dto/team.dto';
import { UpdateTeamWorkflowStatesDto } from './dto/workflow-state.dto';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  findAll(@Req() req: Request & { userId: string }) {
    return this.teamsService.findAll(req.userId);
  }

  @Get(':id')
  findById(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.teamsService.findById(id, req.userId);
  }

  @Post()
  create(@Req() req: Request & { userId: string }, @Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto, req.userId);
  }

  @Post(':id/members')
  addMember(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: AddTeamMemberDto) {
    return this.teamsService.addMember(id, dto, req.userId);
  }

  @Patch(':id/members/:userId')
  updateMember(@Req() req: Request & { userId: string }, @Param('id') id: string, @Param('userId') userId: string, @Body() dto: UpdateTeamMemberDto) {
    return this.teamsService.updateMember(id, userId, dto, req.userId);
  }

  @Post(':id/join')
  join(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.teamsService.join(id, req.userId);
  }

  @Delete(':id/members/:userId')
  removeMember(@Req() req: Request & { userId: string }, @Param('id') id: string, @Param('userId') userId: string) {
    return this.teamsService.removeMember(id, userId, req.userId);
  }

  @Get(':id/workflow-states')
  getWorkflowStates(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.teamsService.getWorkflowStates(id, req.userId);
  }

  @Patch(':id/workflow-states')
  updateWorkflowStates(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: UpdateTeamWorkflowStatesDto) {
    return this.teamsService.updateWorkflowStates(id, dto, req.userId);
  }

  @Patch(':id')
  update(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamsService.update(id, dto, req.userId);
  }

  @Delete(':id')
  delete(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.teamsService.delete(id, req.userId);
  }
}
