import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BADGES, BadgeId } from './badges';

const XP_PER_TASK = 25;
const XP_PER_REFERRAL = 100;

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  stats(userId: string) {
    return this.prisma.userStats.findUnique({ where: { userId } });
  }

  /**
   * Atomically: bump xp, touch streak, recompute level, maybe award badges.
   * Returns the updated stats row.
   */
  async addXp(
    userId: string,
    amount: number,
    reason: 'task' | 'referral' | 'manual' = 'manual',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const stats =
        (await tx.userStats.findUnique({ where: { userId } })) ??
        (await tx.userStats.create({ data: { userId } }));

      const streak = this.computeStreak(stats.lastActiveAt, stats.streak);
      const xp = stats.xp + amount;
      const level = this.levelFor(xp);

      const badges = new Set<string>(stats.badges);
      if (reason === 'task') await this.maybeAwardForTasks(tx, userId, badges);
      if (streak >= 7) badges.add(BADGES.DAILY_GRINDER);
      if (level >= 10) badges.add(BADGES.SECURITY_EXPERT);

      return tx.userStats.update({
        where: { userId },
        data: {
          xp,
          level,
          streak,
          badges: [...badges],
          lastActiveAt: new Date(),
        },
      });
    });
  }

  leaderboard(limit = 20) {
    return this.prisma.userStats.findMany({
      orderBy: [{ xp: 'desc' }, { streak: 'desc' }],
      take: limit,
      include: { user: { select: { username: true, referralCode: true } } },
    });
  }

  /** floor(sqrt(xp/100)) + 1 — gentle quadratic curve. Level 2 at 100, level 3 at 400, level 4 at 900. */
  private levelFor(xp: number) {
    return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
  }

  /** UTC day-bucket streak math: same day = no change, +1 day = bump, gap = reset to 1. */
  private computeStreak(lastActive: Date, previous: number) {
    const dayMs = 86_400_000;
    const last = Math.floor(lastActive.getTime() / dayMs);
    const today = Math.floor(Date.now() / dayMs);
    const diff = today - last;
    if (diff === 0) return Math.max(previous, 1);
    if (diff === 1) return previous + 1;
    return 1;
  }

  private async maybeAwardForTasks(
    tx: any,
    userId: string,
    badges: Set<string>,
  ) {
    const completed = await tx.airdropTask.count({
      where: { userId, status: 'completed' },
    });
    if (completed >= 1) badges.add(BADGES.VERIFIED_EXPLORER);
    if (completed >= 25) badges.add(BADGES.AIRDROP_MASTER);
  }

  // Hooks called from listeners — kept tiny so listeners stay declarative.
  rewardTaskCompletion(userId: string) {
    return this.addXp(userId, XP_PER_TASK, 'task');
  }

  rewardReferral(userId: string) {
    return this.addXp(userId, XP_PER_REFERRAL, 'referral');
  }
}
