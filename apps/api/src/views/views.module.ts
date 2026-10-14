import { Module } from '@nestjs/common';
import { DatabaseModule } from '../common/database/database.module';
import { FavoritesController, ViewsController } from './views.controller';
import { ViewsService } from './views.service';

@Module({ imports: [DatabaseModule], controllers: [ViewsController, FavoritesController], providers: [ViewsService] })
export class ViewsModule {}
