import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { EVENTS } from '../events/event-names';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Event-driven side-effects bridge: turns spec §5 events into user-facing notifications.
 * Keeps the producer modules (airdrops, security, wallet) from depending on the
 * notification module directly — important for module-graph health.
 */
@Injectable()
export class NotificationsListener {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(EVENTS.AIRDROP_CREATED)
  onAirdropCreated(payload: { airdropId: string; name: string }) {
    return this.notifications.broadcastAirdrop(payload.airdropId, payload.name);
  }

  @OnEvent(EVENTS.AIRDROP_FLAGGED)
  async onAirdropFlagged(payload: {
    airdropId: string;
    scamProbability: number;
  }) {
    const airdrop = await this.prisma.airdrop.findUnique({
      where: { id: payload.airdropId },
    });
    if (!airdrop) return;
    const users = await this.prisma.user.findMany({ select: { id: true } });
    await Promise.allSettled(
      users.map((u) =>
        this.notifications.send({
          userId: u.id,
          type: 'scam_warning',
          title: 'High-risk project detected',
          body: `${airdrop.name} is showing a ${payload.scamProbability}% scam signal. Review carefully.`,
        }),
      ),
    );
  }

  @OnEvent(EVENTS.WALLET_RISK_DETECTED)
  async onWalletRisk(payload: { address: string; score: number }) {
    const user = await this.prisma.user.findUnique({
      where: { walletAddress: payload.address },
    });
    if (!user) return;
    await this.notifications.send({
      userId: user.id,
      type: 'wallet_risk',
      title: 'Wallet exposed to risky contract',
      body: `Wallet health dropped to ${payload.score}/100. Open SwiftyDrop Guard for full details and recommended actions.`,
    });
  }
}
