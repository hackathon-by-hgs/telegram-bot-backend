import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const NOTIFICATION_TYPES = [
  'new_airdrop',
  'deadline_alert',
  'scam_warning',
  'wallet_risk',
  'task_update',
] as const;
export type NotificationTypeDto = (typeof NOTIFICATION_TYPES)[number];

export class SendNotificationDto {
  @ApiProperty({
    description: 'Recipient user ID',
    example: 'ckxk7g2v90000abcd1234efgh',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    description:
      'Notification category — drives styling/grouping in the client.',
    enum: NOTIFICATION_TYPES,
    example: 'deadline_alert',
  })
  @IsIn(NOTIFICATION_TYPES)
  type!: NotificationTypeDto;

  @ApiProperty({
    description: 'Short headline (≤ 120 chars).',
    example: 'Bridge before midnight!',
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiProperty({
    description: 'Body text. Markdown rendered as Telegram MarkdownV2.',
    example:
      'The zkSync campaign closes in 2 hours. Tap to finish your checklist.',
    maxLength: 1000,
  })
  @IsString()
  @MaxLength(1000)
  body!: string;
}

export class SendNotificationResponseDto {
  @ApiProperty({
    description:
      '`true` when both persistence and Telegram delivery succeeded.',
    example: true,
  })
  ok!: boolean;

  @ApiPropertyOptional({
    description: 'Notification row ID.',
    example: 'ckxk7g2v90400abcd1234efgh',
  })
  id?: string;

  @ApiPropertyOptional({
    description:
      'When `ok=false`, why it failed (e.g. `user_not_found`, `telegram_send_failed`).',
    example: 'telegram_send_failed',
  })
  reason?: string;
}
