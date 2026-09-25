import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto } from './dto/team.dto';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  findAll() {
    return this.teamsService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.teamsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: AddTeamMemberDto) {
    return this.teamsService.addMember(id, dto);
  }

  @Delete(':id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.teamsService.removeMember(id, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.teamsService.delete(id);
  }
}
