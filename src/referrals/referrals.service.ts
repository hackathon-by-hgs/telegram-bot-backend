import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  /** All referrals attributed to this user, plus a count for quick UI display. */
  async forUser(userId: string) {
    const [referrals, count] = await Promise.all([
      this.prisma.referral.findMany({
        where: { referrerId: userId },
        include: { referredUser: { select: { username: true, createdAt: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.referral.count({ where: { referrerId: userId } }),
    ]);
    return { count, referrals };
  }

  /** Marks a referral row as having paid out — kept idempotent. */
  markRewarded(referralId: string) {
    return this.prisma.referral.update({
      where: { id: referralId },
      data: { rewardGranted: true },
    });
  }
}
