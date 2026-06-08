import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GamificationService } from '../gamification/gamification.service';
import { SecurityService } from '../security/security.service';
import { SwiftyExService } from '../swiftyex/swiftyex.service';

/**
 * Smart Alert System (spec §2.11). Monitors:
 *   - expiring campaigns        -> deadline_alert
 *   - stale security data       -> re-evaluate trust score
 *   - leaderboard recalc        -> warm Redis when we add it
 */
@Injectable()
export class AlertsCron {
  private readonly log = new Logger(AlertsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly gamification: GamificationService,
    private readonly security: SecurityService,
    private readonly swiftyEx: SwiftyExService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async deadlineSweep() {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const expiring = await this.prisma.airdrop.findMany({
      where: { deadline: { gt: new Date(), lt: soon } },
      select: { id: true, name: true, deadline: true },
    });
    if (!expiring.length) return;

    // Notify users who actually have tasks tracked for these airdrops.
    for (const a of expiring) {
      const users = await this.prisma.airdropTask.findMany({
        where: { airdropId: a.id, status: { not: 'completed' } },
        select: { userId: true },
        distinct: ['userId'],
      });
      await Promise.allSettled(
        users.map((u) =>
          this.notifications.send({
            userId: u.userId,
            type: 'deadline_alert',
            title: 'Airdrop deadline approaching',
            body: `${a.name} closes ${a.deadline?.toUTCString()}. Finish your checklist to qualify.`,
          }),
        ),
      );
    }
    this.log.log(`Deadline sweep notified across ${expiring.length} airdrops`);
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  async scamReEvaluation() {
    // Spec §4 — re-score airdrops whose security data is older than 24h.
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stale = await this.prisma.airdrop.findMany({
      where: {
        OR: [{ trustScore: null }, { createdAt: { lt: cutoff } }],
      },
      take: 25,
    });
    for (const a of stale) {
      const links = (a.socialLinks ?? {}) as Record<string, string>;
      await this.security.analyzeAirdrop({
        airdropId: a.id,
        domain: links.website,
        socialLinks: links,
      });
    }
    this.log.log(`Re-evaluated ${stale.length} airdrops`);
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async swiftyExRatesSync() {
    // Public feed — no initData. Warms the SwiftyExRate cache so /api/swiftyex/rates
    // and any rate-driven features serve instantly and survive upstream outages.
    const rates = await this.swiftyEx.cacheRates();
    this.log.log(`SwiftyEx rates synced: ${rates.length} assets`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async leaderboardRecalc() {
    // Touch the leaderboard service — currently a pure read, but caching would warm here.
    const top = await this.gamification.leaderboard(20);
    this.log.log(`Leaderboard recalc: top user ${top[0]?.userId ?? 'none'}`);
  }
}
