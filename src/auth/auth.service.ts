import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { verifyTelegramInitData } from './telegram.validator';

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {}

  async authenticateTelegram(initData: string) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    try {
      const verified = verifyTelegramInitData(initData, token);
      const user = await this.users.upsertFromTelegram({
        telegramId: String(verified.user.id),
        username: verified.user.username,
        referralCode: verified.startParam,
      });
      return { user };
    } catch (err) {
      throw new UnauthorizedException((err as Error).message);
    }
  }
}
