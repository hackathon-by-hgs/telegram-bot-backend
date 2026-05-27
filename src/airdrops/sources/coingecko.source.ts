import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AirdropSource, NormalizedAirdrop } from '../airdrop-source.interface';

/**
 * CoinGecko has no first-class airdrop endpoint on the free tier, so we use its
 * "trending" coins as a discovery proxy — newer trending tokens often coincide
 * with airdrop campaigns. Real production would replace this with the paid
 * GeckoTerminal endpoint or a dedicated airdrop API.
 */
@Injectable()
export class CoinGeckoSource implements AirdropSource {
  readonly name = 'coingecko';
  private readonly log = new Logger(CoinGeckoSource.name);

  constructor(private readonly http: HttpService) {}

  async fetch(): Promise<NormalizedAirdrop[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get('https://api.coingecko.com/api/v3/search/trending', { timeout: 8000 }),
      );
      const coins: Array<{ item: { id: string; name: string; symbol: string } }> = data?.coins ?? [];
      return coins.map(({ item }) => ({
        externalId: `${this.name}:${item.id}`,
        name: `${item.name} (${item.symbol.toUpperCase()})`,
        description: 'Trending project — potential airdrop candidate',
        category: 'trending',
        difficulty: 'easy',
        source: this.name,
      }));
    } catch (err) {
      this.log.warn(`coingecko fetch failed: ${(err as Error).message}`);
      return [];
    }
  }
}
