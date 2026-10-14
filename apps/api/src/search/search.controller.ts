import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Req() req: Request & { userId: string }, @Query('q') query: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.searchService.globalSearch(query || '', req.userId, limit, offset);
  }
}
