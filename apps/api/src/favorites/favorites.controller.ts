import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { FavoriteDto } from './dto/favorites.dto';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}
  @Get() list(@Req() req: Request & { userId: string }) { return this.favorites.listFavorites(req.userId); }
  @Post() add(@Req() req: Request & { userId: string }, @Body() body: FavoriteDto) { return this.favorites.addFavorite(req.userId, body.resourceType, body.resourceId); }
  @Delete(':resourceType/:resourceId') remove(@Req() req: Request & { userId: string }, @Param('resourceType') type: string, @Param('resourceId') id: string) { return this.favorites.removeFavorite(req.userId, type, id); }
}
