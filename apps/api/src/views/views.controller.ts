import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CreateViewDto, FavoriteDto, UpdateViewDto } from './dto/views.dto';
import { ViewsService } from './views.service';

@Controller('views')
export class ViewsController {
  constructor(private readonly views: ViewsService) {}
  @Get() list(@Req() req: Request & { userId: string }, @Query('teamId') teamId?: string) { return this.views.list(req.userId, teamId); }
  @Post() create(@Req() req: Request & { userId: string }, @Body() body: CreateViewDto) { return this.views.create(req.userId, body); }
  @Patch(':id') update(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() body: UpdateViewDto) { return this.views.update(id, req.userId, body); }
  @Delete(':id') delete(@Req() req: Request & { userId: string }, @Param('id') id: string) { return this.views.delete(id, req.userId); }
}

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly views: ViewsService) {}
  @Get() list(@Req() req: Request & { userId: string }) { return this.views.listFavorites(req.userId); }
  @Post() add(@Req() req: Request & { userId: string }, @Body() body: FavoriteDto) { return this.views.addFavorite(req.userId, body.resourceType, body.resourceId); }
  @Delete(':resourceType/:resourceId') remove(@Req() req: Request & { userId: string }, @Param('resourceType') type: string, @Param('resourceId') id: string) { return this.views.removeFavorite(req.userId, type, id); }
}
