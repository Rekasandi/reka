import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { InsightsService } from './insights.service';
import { InsightsCycleQueryDto, InsightsReportQueryDto } from './dto/insights.dto';

@Controller('insights')
export class InsightsController {
  constructor(private readonly service: InsightsService) {}

  @Get('overview')
  overview(@Req() req: Request & { userId: string }, @Query() query: InsightsReportQueryDto) {
    return this.service.overview(req.userId, query);
  }

  @Get('cycles')
  cycleReport(@Req() req: Request & { userId: string }, @Query() query: InsightsCycleQueryDto) {
    return this.service.cycleReport(req.userId, query);
  }
}
