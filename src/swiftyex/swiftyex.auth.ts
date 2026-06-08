import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SwiftyExAuthMode = 'forward' | 'service';

/**
 * The ONE place that knows how SwiftyEx authenticates a caller. Isolated so the
 * service/controller never branch on it.
 *
 *   forward  (default): SwiftyEx is the SAME Telegram bot as us, so the user's
 *            initData hash validates there too — forward it verbatim.
 *   service:           SwiftyEx is a DIFFERENT bot; initData won't cross-validate.
 *            Authenticate service-to-service with a shared token + chat_id.
 *
 * Flip SWIFTYEX_AUTH_MODE once the bot identity is confirmed — no other code changes.
 */
@Injectable()
export class SwiftyExAuth {
  constructor(private readonly config: ConfigService) {}

  get mode(): SwiftyExAuthMode {
    return (
      (this.config.get<string>('SWIFTYEX_AUTH_MODE') as SwiftyExAuthMode) ??
      'forward'
    );
  }

  /**
   * Build the body fields SwiftyEx needs to identify the caller.
   * @param initData   raw Telegram initData from the current request (may be '')
   * @param telegramId our User.telegramId, used as chat_id in service mode
   */
  authPayload(initData = '', telegramId?: string): Record<string, unknown> {
    if (this.mode === 'service') {
      return {
        chat_id: telegramId,
        service_token: this.config.get<string>('SWIFTYEX_SERVICE_TOKEN'),
      };
    }
    return { initData };
  }
}
