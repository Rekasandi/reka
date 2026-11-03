import { Module } from '@nestjs/common';
import { DatabaseModule } from '../common/database/database.module';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({ imports: [DatabaseModule], controllers: [FavoritesController], providers: [FavoritesService] })
export class FavoritesModule {}
