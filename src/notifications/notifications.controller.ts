import { Body, Controller, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import type { NotificationType } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // POST /notifications/send
  @Post('send')
  send(
    @Body('userId') userId: string,
    @Body('type') type: NotificationType,
    @Body('title') title: string,
    @Body('body') body: string,
  ) {
    return this.notifications.send({ userId, type, title, body });
  }
}
