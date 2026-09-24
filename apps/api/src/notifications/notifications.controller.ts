import { Controller, Get, Param } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('by-user/:userId')
  findByUserId(@Param('userId') userId: string) {
    return this.notificationsService.findByUserId(userId);
  }
}
