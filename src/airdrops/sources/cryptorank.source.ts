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
        source: this.name,
      }));
    } catch (err) {
      this.log.warn(`cryptorank fetch failed: ${(err as Error).message}`);
      return [];
    }
  }
}
