import { createHmac } from 'crypto';

export interface TelegramUserPayload {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface VerifiedInitData {
  user: TelegramUserPayload;
  authDate: number;
  startParam?: string;
}

/**
 * Verifies Telegram Mini App initData per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * secret_key = HMAC_SHA256("WebAppData", bot_token)   <-- intentional key/data swap
 * hash       = HMAC_SHA256(secret_key, data_check_string)
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
): VerifiedInitData {
  if (!botToken) throw new Error('Missing TELEGRAM_BOT_TOKEN');

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new Error('initData missing hash');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => [k, v] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computed !== hash) throw new Error('initData hash mismatch');

  const authDate = Number(params.get('auth_date') ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) {
    throw new Error('initData expired');
  }

  const userRaw = params.get('user');
  if (!userRaw) throw new Error('initData missing user');
  const user = JSON.parse(userRaw) as TelegramUserPayload;

  return { user, authDate, startParam: params.get('start_param') ?? undefined };
}
