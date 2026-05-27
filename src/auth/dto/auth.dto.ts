import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { UserDto } from '../../common/dto/models.dto';

export class TelegramAuthDto {
  @ApiProperty({
    description:
      'Raw `window.Telegram.WebApp.initData` string from the Mini App. The server verifies its HMAC against `TELEGRAM_BOT_TOKEN`.',
    example:
      'query_id=AAH...&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Satoshi%22%7D&auth_date=1716798000&hash=abc123...',
  })
  @IsString()
  @IsNotEmpty()
  initData!: string;
}

export class TelegramAuthResponseDto {
  @ApiProperty({
    type: () => UserDto,
    description: 'The user record matching the Telegram identity (created on first sign-in).',
  })
  user!: UserDto;
}
