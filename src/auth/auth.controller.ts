import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { TelegramAuthDto, TelegramAuthResponseDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('telegram')
  @ApiOperation({
    summary: 'Authenticate a Telegram Mini App user',
    description:
      'Verifies the HMAC signature of the supplied `initData` against `TELEGRAM_BOT_TOKEN`, then upserts the corresponding user. ' +
      'This is the only endpoint that performs identity verification — call it once on Mini App load and persist the returned user ID.',
  })
  @ApiBody({ type: TelegramAuthDto })
  @ApiOkResponse({ type: TelegramAuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'initData missing, malformed, or HMAC verification failed.' })
  telegram(@Body() dto: TelegramAuthDto) {
    return this.auth.authenticateTelegram(dto.initData ?? '');
  }
}
