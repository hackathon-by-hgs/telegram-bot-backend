import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TelegramBotService {
  private readonly log = new Logger(TelegramBotService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  /** Posts a message via Telegram Bot API. No-ops cleanly when no token is configured. */
  async send(
    chatId: string,
    text: string,
    opts: { parseMode?: 'Markdown' | 'HTML'; replyMarkup?: unknown } = {},
  ) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.log.debug(`(no token) would send to ${chatId}: ${text}`);
      return { ok: false, skipped: true };
    }
    try {
      const { data } = await firstValueFrom(
        this.http.post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: chatId,
          text,
          parse_mode: opts.parseMode ?? 'Markdown',
          disable_web_page_preview: true,
          // Optional inline keyboard. callback_data buttons are answered by the
          // long-polling Telegraf bot (same token), so no handler is needed here.
          ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
        }),
      );
      return data;
    } catch (err) {
      this.log.warn(`telegram send failed: ${(err as Error).message}`);
      return { ok: false };
    }
  }
}
