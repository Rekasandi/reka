import { Controller, Get, Post, Patch, Put, Delete, Param, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CyclesService } from './cycles.service';
import { CreateCycleDto, UpdateCycleDto, CompleteCycleDto, TeamCycleSettingsDto } from './dto/cycle.dto';

@Controller('cycles')
export class CyclesController {
  constructor(private readonly cyclesService: CyclesService) {}

  @Get()
  findAll(@Req() req: Request & { userId: string }) {
    return this.cyclesService.findAll(req.userId);
  }

  @Get('settings/:teamId')
  getTeamSettings(@Req() req: Request & { userId: string }, @Param('teamId') teamId: string) {
    return this.cyclesService.getTeamSettings(teamId, req.userId);
  }

  @Put('settings/:teamId')
  saveTeamSettings(@Req() req: Request & { userId: string }, @Param('teamId') teamId: string, @Body() dto: TeamCycleSettingsDto) {
    return this.cyclesService.saveTeamSettings(teamId, dto, req.userId);
  }

  @Get(':id/history')
  history(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.cyclesService.history(id, req.userId);
  }

  @Get(':id')
  findById(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.cyclesService.findById(id, req.userId);
  }

  @Get('by-team/:teamId')
  findByTeamId(@Req() req: Request & { userId: string }, @Param('teamId') teamId: string) {
    return this.cyclesService.findByTeamId(teamId, req.userId);
  }

  @Post()
  create(@Req() req: Request & { userId: string }, @Body() dto: CreateCycleDto) {
    return this.cyclesService.create(dto, req.userId);
  }

  @Post(':id/complete')
  completeCycle(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: CompleteCycleDto) {
    return this.cyclesService.completeCycle(id, dto, req.userId);
  }

  @Post(':id/reopen')
  reopenCycle(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.cyclesService.reopenCycle(id, req.userId);
  }

  @Patch(':id')
  update(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: UpdateCycleDto) {
    return this.cyclesService.update(id, dto, req.userId);
  }

  @Delete(':id')
  delete(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.cyclesService.delete(id, req.userId);
  }
}
