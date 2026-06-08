import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AirdropSource, NormalizedAirdrop } from '../airdrop-source.interface';

@Injectable()
export class CryptoRankSource implements AirdropSource {
  readonly name = 'cryptorank';
  private readonly log = new Logger(CryptoRankSource.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async fetch(): Promise<NormalizedAirdrop[]> {
    const apiKey = this.config.get<string>('CRYPTORANK_API_KEY');
    // No key configured? Return [] cleanly — never throw. (Spec §7 graceful degradation.)
    if (!apiKey) return [];
    try {
      const { data } = await firstValueFrom(
        this.http.get('https://api.cryptorank.io/v1/funds-rounds', {
          params: { api_key: apiKey, limit: 25 },
          timeout: 8000,
        }),
      );
      const rounds: any[] = data?.data ?? [];
      return rounds.map((r) => ({
        externalId: `${this.name}:${r.id}`,
        name: r.name ?? 'Untitled round',
        description: r.description,
        rewardEstimate: r.raise ? `$${r.raise}` : undefined,
        deadline: r.endDate ? new Date(r.endDate) : undefined,
        category: r.type ?? 'funding',
        difficulty: 'medium',
        projectUrl: r.link ?? r.website ?? undefined,
        socialLinks: this.normalizeLinks(r.links ?? r.social),
        source: this.name,
      }));
    } catch (err) {
      this.log.warn(`cryptorank fetch failed: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * CryptoRank exposes links as either an array of {type, value} entries or a
   * flat {key: url} object depending on plan/version. Normalize both into the
   * shared {twitter, telegram, website, ...} shape; unknown link types pass
   * through under their own key.
   */
  private normalizeLinks(raw: unknown): Record<string, string> {
    const KEY_MAP: Record<string, string> = {
      web: 'website',
      website: 'website',
      twitter: 'twitter',
      x: 'twitter',
      telegram: 'telegram',
    };
    const out: Record<string, string> = {};
    const put = (type: string, value: unknown) => {
      if (typeof value !== 'string' || !value) return;
      const key = KEY_MAP[type.toLowerCase()] ?? type.toLowerCase();
      out[key] = value;
    };

    if (Array.isArray(raw)) {
      for (const entry of raw) put(entry?.type ?? '', entry?.value ?? entry?.url);
    } else if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) put(k, v);
    }
    return out;
  }
}
