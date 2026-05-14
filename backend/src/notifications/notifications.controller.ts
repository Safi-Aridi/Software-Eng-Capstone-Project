import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getByUser(@Query('userId') userId: string) {
    return this.notificationsService.getByUser(userId);
  }

  @Post()
  create(@Body() body: { userId: string; applicationId?: string | null; message: string }) {
    return this.notificationsService.create(
      body.userId,
      body.applicationId ?? null,
      body.message,
    );
  }

  @Patch('read-all')
  markAllAsRead(@Body() body: { userId: string }) {
    return this.notificationsService.markAllAsRead(body.userId);
  }

  @Get('unread-count')
  getUnreadCount(@Query('userId') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }
}
