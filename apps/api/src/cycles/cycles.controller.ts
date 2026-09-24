import { Controller, Get, Param } from '@nestjs/common';
import { CyclesService } from './cycles.service';

@Controller('cycles')
export class CyclesController {
  constructor(private readonly cyclesService: CyclesService) {}

  @Get('by-team/:teamId')
  findByTeamId(@Param('teamId') teamId: string) {
    return this.cyclesService.findByTeamId(teamId);
  }
}
