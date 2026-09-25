import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { CyclesService } from './cycles.service';
import { CreateCycleDto, UpdateCycleDto, CompleteCycleDto } from './dto/cycle.dto';

@Controller('cycles')
export class CyclesController {
  constructor(private readonly cyclesService: CyclesService) {}

  @Get()
  findAll() {
    return this.cyclesService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.cyclesService.findById(id);
  }

  @Get('by-team/:teamId')
  findByTeamId(@Param('teamId') teamId: string) {
    return this.cyclesService.findByTeamId(teamId);
  }

  @Post()
  create(@Body() dto: CreateCycleDto) {
    return this.cyclesService.create(dto);
  }

  @Post(':id/complete')
  completeCycle(@Param('id') id: string, @Body() dto: CompleteCycleDto) {
    return this.cyclesService.completeCycle(id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCycleDto) {
    return this.cyclesService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.cyclesService.delete(id);
  }
}
