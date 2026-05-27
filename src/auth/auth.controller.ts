import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // POST /auth/telegram  — body: { initData: string }
  @Post('telegram')
  telegram(@Body('initData') initData: string) {
    return this.auth.authenticateTelegram(initData ?? '');
  }
}
