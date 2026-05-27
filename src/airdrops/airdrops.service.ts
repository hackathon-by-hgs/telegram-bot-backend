import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AirdropSource } from './airdrop-source.interface';
import { CoinGeckoSource } from './sources/coingecko.source';
import { CryptoRankSource } from './sources/cryptorank.source';
import { EVENTS } from '../events/event-names';

@Injectable()
export class AirdropsService {
  private readonly log = new Logger(AirdropsService.name);
  private readonly sources: AirdropSource[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    coinGecko: CoinGeckoSource,
    cryptoRank: CryptoRankSource,
  ) {
    this.sources = [coinGecko, cryptoRank];
  }

  list(opts: { take?: number; skip?: number } = {}) {
    return this.prisma.airdrop.findMany({
      take: opts.take ?? 50,
      skip: opts.skip ?? 0,
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const airdrop = await this.prisma.airdrop.findUnique({
      where: { id },
      include: { securityReports: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!airdrop) throw new NotFoundException();
    return airdrop;
  }

  /** Cron-driven sync — fans out across configured sources in parallel and upserts. */
  async syncAll() {
    const settled = await Promise.allSettled(this.sources.map((s) => s.fetch()));
    const flattened = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    this.log.log(`Fetched ${flattened.length} candidates from ${this.sources.length} sources`);

    let created = 0;
    for (const a of flattened) {
      const existing = await this.prisma.airdrop.findUnique({ where: { externalId: a.externalId } });
      if (existing) continue;
      const row = await this.prisma.airdrop.create({
        data: {
          externalId: a.externalId,
          name: a.name,
          description: a.description,
          rewardEstimate: a.rewardEstimate,
          deadline: a.deadline,
          category: a.category,
          difficulty: a.difficulty,
          socialLinks: a.socialLinks ?? {},
          source: a.source,
        },
      });
      created++;
      this.events.emit(EVENTS.AIRDROP_CREATED, { airdropId: row.id, name: row.name });
    }
    return { fetched: flattened.length, created };
  }
}
