import { Controller, Get, Post, Patch, Put, Delete, Param, Body, Query, Req, Sse } from '@nestjs/common';
import type { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { SnoozeNotificationDto, UpdateNotificationDto, UpdateNotificationPreferencesDto } from './dto/notification.dto';

type AuthenticatedRequest = Request & { userId: string };

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('preferences')
  getPreferences(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getPreferences(req.userId);
  }

  @Put('preferences')
  savePreferences(@Req() req: AuthenticatedRequest, @Body() dto: UpdateNotificationPreferencesDto) {
    return this.notificationsService.savePreferences(req.userId, dto);
  }

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('read') read?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('snoozed') snoozed?: string,
  ) {
    return this.notificationsService.findAll(req.userId, {
      read: read !== undefined ? read === 'true' : undefined,
      type,
      limit: limit ? parseInt(limit, 10) : undefined,
      snoozed: snoozed === 'true',
    });
  }

  @Get('unread-count')
  getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getUnreadCount(req.userId);
  }

  /** Live unread count (replaces polling). EventSource sends the session cookie, so the normal auth guard applies. */
  @Sse('unread-count/stream')
  streamUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.unreadCountStream(req.userId);
  }

  @Patch(':id/read')
  markAsRead(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateNotificationDto) {
    return this.notificationsService.markAsRead(id, req.userId, dto.read ?? true);
  }

  @Patch(':id/snooze')
  snooze(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: SnoozeNotificationDto) {
    return this.notificationsService.snooze(id, req.userId, dto.until);
  }

  @Post('mark-all-read')
  markAllAsRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAllAsRead(req.userId);
  }

  @Post('clear-read')
  clearRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.clearRead(req.userId);
  }

  @Delete(':id')
  delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.notificationsService.delete(id, req.userId);
  }
}
