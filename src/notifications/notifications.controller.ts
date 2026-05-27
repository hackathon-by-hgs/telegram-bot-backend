import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto, SendNotificationResponseDto } from './dto/notifications.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('send')
  @ApiOperation({
    summary: 'Send a notification (persist-then-deliver)',
    description:
      'Creates a `Notification` row first (source of truth), then dispatches to Telegram. The row is updated to ' +
      '`status: sent` on success or `status: failed` with a reason on failure. Safe to retry on `ok: false`.',
  })
  @ApiOkResponse({ type: SendNotificationResponseDto })
  send(@Body() dto: SendNotificationDto) {
    return this.notifications.send({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      body: dto.body,
    });
  }
}
