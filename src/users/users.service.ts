import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EVENTS } from '../events/event-names';

interface UpsertInput {
  telegramId: string;
  username?: string;
  referralCode?: string; // start_param of the inviter
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async upsertFromTelegram({
    telegramId,
    username,
    referralCode,
  }: UpsertInput) {
    const existing = await this.prisma.user.findUnique({
      where: { telegramId },
    });
    if (existing) return existing;

    let referredById: string | undefined;
    if (referralCode) {
      const referrer = await this.prisma.user.findUnique({
        where: { referralCode },
      });
      if (referrer) referredById = referrer.id;
    }

    const user = await this.prisma.user.create({
      data: {
        telegramId,
        username,
        referralCode: this.generateReferralCode(),
        referredById,
        stats: { create: {} },
      },
    });

    if (referredById) {
      await this.prisma.referral.create({
        data: { referrerId: referredById, referredUserId: user.id },
      });
      this.events.emit(EVENTS.REFERRAL_COMPLETED, {
        referrerId: referredById,
        userId: user.id,
      });
    }

    this.events.emit(EVENTS.USER_SIGNUP, { userId: user.id });
    return user;
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { stats: true },
    });
  }

  attachWallet(userId: string, walletAddress: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { walletAddress },
    });
  }

  private generateReferralCode() {
    return randomBytes(4).toString('hex'); // 8 hex chars, ~4B keyspace
  }
}
