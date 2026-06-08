import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { firstValueFrom } from 'rxjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EVENTS } from '../events/event-names';
import { SwiftyExAuth } from './swiftyex.auth';
import { SwiftyExWebhookDto } from './dto/swiftyex.dto';

export interface RawWallet {
  wallet_type: string;
  blockchain?: string;
  balance?: string | number;
  address?: string;
}

export interface RawMe {
  chat_id: string;
  username?: string;
  first_name?: string;
  kyc_verified?: boolean;
  kyc_level?: number;
  referral_code?: string;
}

/**
 * Client for the SwiftyEx Mini App API (POST /miniapp/me|wallets|transactions,
 * GET /miniapp/rates). Follows the repo's resilient-client pattern: timeouts,
 * try/catch with graceful degradation, and ConfigService for the base URL.
 *
 * Proxy reads (me/wallets/transactions/rates) are thin pass-throughs.
 * sync() additionally persists a snapshot and emits domain events.
 */
@Injectable()
export class SwiftyExService {
  private readonly log = new Logger(SwiftyExService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
    private readonly prisma: PrismaService,
    private readonly auth: SwiftyExAuth,
  ) {}

  private get base(): string {
    return (
      this.config.get<string>('SWIFTYEX_BASE_URL') ?? 'http://localhost:8000'
    );
  }

  // ---------------------------------------------------------------- proxy reads

  async me(initData = '', telegramId?: string): Promise<RawMe> {
    return this.post<RawMe>('/miniapp/me', initData, telegramId);
  }

  async wallets(initData = '', telegramId?: string): Promise<RawWallet[]> {
    const data = await this.post<{ wallets?: RawWallet[] } | RawWallet[]>(
      '/miniapp/wallets',
      initData,
      telegramId,
    );
    return Array.isArray(data) ? data : (data?.wallets ?? []);
  }

  async transactions(
    initData = '',
    page = 1,
    walletType?: string,
    telegramId?: string,
  ): Promise<unknown> {
    return this.post('/miniapp/transactions', initData, telegramId, {
      page,
      ...(walletType ? { wallet_type: walletType } : {}),
    });
  }

  /** Public endpoint — no auth required. */
  async rates(): Promise<
    Array<{ asset: string; buyRate: number; sellRate: number }>
  > {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.base}/miniapp/rates`, { timeout: 8000 }),
      );
      return this.normalizeRates(data);
    } catch (err) {
      this.log.warn(`swiftyex rates fetch failed: ${(err as Error).message}`);
      // Serve last cached rates on failure (graceful degradation).
      const cached = await this.prisma.swiftyExRate
        .findMany()
        .catch(
          () =>
            [] as Array<{ asset: string; buyRate: number; sellRate: number }>,
        );
      return cached.map((r) => ({
        asset: r.asset,
        buyRate: r.buyRate,
        sellRate: r.sellRate,
      }));
    }
  }

  // ----------------------------------------------------------- stateful sync

  /**
   * Pull profile + wallets for the current user, persist a snapshot keyed by our
   * User (telegramId == SwiftyEx chat_id), and emit domain events on:
   *   - first link            -> SWIFTYEX_LINKED
   *   - kyc_level increase     -> SWIFTYEX_KYC_UPGRADED
   *   - any balance increase   -> SWIFTYEX_DEPOSIT_CONFIRMED (per asset)
   * Returns the fresh { me, wallets } so callers can also use it as a read.
   */
  async sync(initData = '', telegramId?: string) {
    const [me, wallets] = await Promise.all([
      this.me(initData, telegramId),
      this.wallets(initData, telegramId),
    ]);

    const chatId = me?.chat_id ?? telegramId;
    if (!chatId) {
      this.log.warn('swiftyex sync: no chat_id resolved; skipping persistence');
      return { me, wallets };
    }

    // Map SwiftyEx chat to our local user. We only persist for known users.
    const user = await this.prisma.user
      .findUnique({ where: { telegramId: String(chatId) } })
      .catch(() => null);
    if (!user) {
      this.log.warn(
        `swiftyex sync: no local user for chat ${chatId}; skipping`,
      );
      return { me, wallets };
    }

    const prev = await this.prisma.swiftyExAccount
      .findUnique({ where: { userId: user.id } })
      .catch(() => null);

    // Prisma Json columns expect InputJsonValue; our typed array needs a cast.
    const walletsJson = wallets as unknown as Prisma.InputJsonValue;
    await this.prisma.swiftyExAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        chatId: String(chatId),
        kycVerified: !!me.kyc_verified,
        kycLevel: me.kyc_level ?? 0,
        referralCode: me.referral_code,
        wallets: walletsJson,
        syncedAt: new Date(),
      },
      update: {
        kycVerified: !!me.kyc_verified,
        kycLevel: me.kyc_level ?? 0,
        referralCode: me.referral_code,
        wallets: walletsJson,
        syncedAt: new Date(),
      },
    });

    this.emitDeltas(user.id, prev, me, wallets);
    return { me, wallets };
  }

  /** Refresh the SwiftyExRate cache from the public feed. Called by AlertsCron. */
  async cacheRates() {
    const rates = await this.rates();
    await Promise.allSettled(
      rates.map((r) =>
        this.prisma.swiftyExRate.upsert({
          where: { asset: r.asset },
          create: { asset: r.asset, buyRate: r.buyRate, sellRate: r.sellRate },
          update: {
            buyRate: r.buyRate,
            sellRate: r.sellRate,
            updatedAt: new Date(),
          },
        }),
      ),
    );
    return rates;
  }

  /**
   * Real-time push from SwiftyEx. Fail-closed: requires the configured shared
   * secret to match. Resolves our user by chat_id, reconciles the snapshot, and
   * emits the same domain events that sync() would — so gamification and
   * notifications fire instantly without waiting for the next pull.
   */
  async handleWebhook(dto: SwiftyExWebhookDto, secret?: string) {
    const expected = this.config.get<string>('SWIFTYEX_WEBHOOK_SECRET');
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid SwiftyEx webhook secret');
    }

    const user = await this.prisma.user
      .findUnique({ where: { telegramId: String(dto.chat_id) } })
      .catch(() => null);
    if (!user) {
      this.log.warn(`swiftyex webhook: no local user for chat ${dto.chat_id}`);
      return { ok: false, reason: 'user_not_found' };
    }

    if (dto.event === 'deposit') {
      this.events.emit(EVENTS.SWIFTYEX_DEPOSIT_CONFIRMED, {
        userId: user.id,
        asset: dto.asset ?? 'unknown',
        amount: dto.amount ?? 0,
      });
    } else if (dto.event === 'kyc_upgraded') {
      const level = dto.kyc_level ?? 0;
      // Reconcile the cached snapshot so a later sync() won't re-fire the event.
      await this.prisma.swiftyExAccount
        .updateMany({
          where: { userId: user.id },
          data: { kycLevel: level, kycVerified: level > 0 },
        })
        .catch(() => undefined);
      this.events.emit(EVENTS.SWIFTYEX_KYC_UPGRADED, { userId: user.id, level });
    }

    return { ok: true };
  }

  // ----------------------------------------------------------------- internals

  private emitDeltas(
    userId: string,
    prev: { kycLevel: number; wallets: unknown } | null,
    me: RawMe,
    wallets: RawWallet[],
  ) {
    if (!prev) {
      this.events.emit(EVENTS.SWIFTYEX_LINKED, { userId });
    }

    const newKyc = me.kyc_level ?? 0;
    if (prev && newKyc > prev.kycLevel) {
      this.events.emit(EVENTS.SWIFTYEX_KYC_UPGRADED, { userId, level: newKyc });
    }

    // Balance-delta deposit detection (fallback when no SwiftyEx webhook exists).
    const prevByType = new Map<string, number>(
      (Array.isArray(prev?.wallets) ? (prev.wallets as RawWallet[]) : []).map(
        (w) => [w.wallet_type, Number(w.balance ?? 0)],
      ),
    );
    for (const w of wallets) {
      const before = prevByType.get(w.wallet_type) ?? 0;
      const after = Number(w.balance ?? 0);
      if (prev && after > before) {
        this.events.emit(EVENTS.SWIFTYEX_DEPOSIT_CONFIRMED, {
          userId,
          asset: w.wallet_type,
          amount: Number((after - before).toFixed(8)),
        });
      }
    }
  }

  private normalizeRates(
    data: unknown,
  ): Array<{ asset: string; buyRate: number; sellRate: number }> {
    // SwiftyEx may return an array of Rate rows or an object map; handle both.
    const rows: any[] = Array.isArray(data)
      ? data
      : Object.entries((data as Record<string, any>) ?? {}).map(
          ([asset, v]) => ({
            asset,
            ...v,
          }),
        );
    return rows
      .map((r) => ({
        asset: String(r.asset ?? r.symbol ?? r.currency ?? '').toLowerCase(),
        buyRate: Number(r.buyRate ?? r.buy ?? r.buy_rate ?? 0),
        sellRate: Number(r.sellRate ?? r.sell ?? r.sell_rate ?? 0),
      }))
      .filter((r) => r.asset);
  }

  private async post<T>(
    path: string,
    initData = '',
    telegramId?: string,
    extra: Record<string, unknown> = {},
  ): Promise<T> {
    const body = { ...this.auth.authPayload(initData, telegramId), ...extra };
    const { data } = await firstValueFrom(
      this.http.post(`${this.base}${path}`, body, { timeout: 8000 }),
    );
    return data as T;
  }
}
