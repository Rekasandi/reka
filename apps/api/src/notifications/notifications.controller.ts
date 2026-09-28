import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto, UpdateNotificationDto } from './dto/notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @Query('userId') userId?: string,
    @Query('read') read?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.findAll({
      userId,
      read: read !== undefined ? read === 'true' : undefined,
      type,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('unread-count')
  getUnreadCount(@Query('userId') userId?: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Get('by-user/:userId')
  findByUserId(@Param('userId') userId: string) {
    return this.notificationsService.findByUserId(userId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.notificationsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Body() dto: UpdateNotificationDto) {
    return this.notificationsService.markAsRead(id, dto.read !== undefined ? dto.read : true);
  }

  @Post('mark-all-read')
  markAllAsRead(@Body('userId') userId?: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Post('clear-read')
  clearRead(@Body('userId') userId?: string) {
    return this.notificationsService.clearRead(userId);
  }

  @Post('seed-demo')
  seedDemo(@Body('userId') userId?: string) {
    return this.notificationsService.seedDemo(userId);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.notificationsService.delete(id);
  }
}
