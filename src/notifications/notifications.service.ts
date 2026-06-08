import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';

export type NotificationType =
  | 'new_airdrop'
  | 'deadline_alert'
  | 'scam_warning'
  | 'wallet_risk'
  | 'task_update'
  | 'swiftyex_deposit'
  | 'swiftyex_kyc'
  | 'rate_alert';

interface SendInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Optional inline keyboard (Telegram `reply_markup`) attached to the push. */
  replyMarkup?: unknown;
}

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tg: TelegramBotService,
  ) {}

  /**
   * Persist-then-deliver. The DB row is the source of truth; delivery is best-effort.
   * On startup we could replay `status: "queued"` to recover from crashes mid-send.
   */
  async send({ userId, type, title, body, replyMarkup }: SendInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { ok: false, reason: 'user_not_found' };

    const record = await this.prisma.notification.create({
      data: {
        userId,
        channel: 'telegram',
        type,
        payload: { title, body },
      },
    });

    const text = `*${title}*\n${body}`;
    const result = await this.tg.send(user.telegramId, text, { replyMarkup });

    await this.prisma.notification.update({
      where: { id: record.id },
      data: {
        status: result?.ok === false ? 'failed' : 'sent',
        sentAt: new Date(),
      },
    });

    return { ok: result?.ok !== false, id: record.id };
  }

  async broadcastAirdrop(airdropId: string, name: string) {
    // Spec example: "New verified airdrop available".
    const users = await this.prisma.user.findMany({ select: { id: true } });
    await Promise.allSettled(
      users.map((u) =>
        this.send({
          userId: u.id,
          type: 'new_airdrop',
          title: '🪂 New airdrop available',
          body: `${name} just landed in SwiftyDrop Guard. Tap to view details and trust score.`,
          // The Telegraf bot's `airdrop:<id>` action handles this tap.
          replyMarkup: {
            inline_keyboard: [
              [
                {
                  text: '🪂 View details & trust score',
                  callback_data: `airdrop:${airdropId}`,
                },
              ],
            ],
          },
        }),
      ),
    );
    this.log.log(`Broadcasted airdrop ${airdropId} to ${users.length} users`);
  }
}
