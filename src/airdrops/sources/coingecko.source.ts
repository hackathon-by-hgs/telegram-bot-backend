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

  /** Max concurrent /coins/{id} detail calls — keeps us under the free-tier rate limit. */
  private static readonly ENRICH_CONCURRENCY = 4;

  async fetch(): Promise<NormalizedAirdrop[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get('https://api.coingecko.com/api/v3/search/trending', {
          timeout: 8000,
        }),
      );
      const coins: Array<{
        item: { id: string; name: string; symbol: string };
      }> = data?.coins ?? [];
      const base: NormalizedAirdrop[] = coins.map(({ item }) => ({
        externalId: `${this.name}:${item.id}`,
        name: `${item.name} (${item.symbol.toUpperCase()})`,
        description: 'Trending project — potential airdrop candidate',
        category: 'trending',
        difficulty: 'easy',
        projectUrl: `https://www.coingecko.com/en/coins/${item.id}`,
        source: this.name,
      }));
      return this.enrichSocialLinks(coins.map((c) => c.item.id), base);
    } catch (err) {
      this.log.warn(`coingecko fetch failed: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Trending payloads carry no social handles, so we fan out one /coins/{id}
   * detail call per coin to read its `links` block. Runs in bounded batches to
   * respect the free-tier rate limit; any single failure degrades to {} rather
   * than failing the whole sync.
   */
  private async enrichSocialLinks(
    ids: string[],
    base: NormalizedAirdrop[],
  ): Promise<NormalizedAirdrop[]> {
    const C = CoinGeckoSource.ENRICH_CONCURRENCY;
    for (let i = 0; i < base.length; i += C) {
      const batch = base.slice(i, i + C);
      await Promise.all(
        batch.map(async (airdrop, j) => {
          airdrop.socialLinks = await this.fetchSocialLinks(ids[i + j]);
        }),
      );
    }
    return base;
  }

  private async fetchSocialLinks(id: string): Promise<Record<string, string>> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`https://api.coingecko.com/api/v3/coins/${id}`, {
          params: {
            localization: false,
            tickers: false,
            market_data: false,
            community_data: false,
            developer_data: false,
            sparkline: false,
          },
          timeout: 8000,
        }),
      );
      const links = data?.links ?? {};
      const social: Record<string, string> = {};
      if (links.twitter_screen_name)
        social.twitter = `https://x.com/${links.twitter_screen_name}`;
      if (links.telegram_channel_identifier)
        social.telegram = `https://t.me/${links.telegram_channel_identifier}`;
      if (links.homepage?.[0]) social.website = links.homepage[0];
      if (links.subreddit_url) social.reddit = links.subreddit_url;
      return social;
    } catch (err) {
      this.log.warn(
        `coingecko detail fetch failed for ${id}: ${(err as Error).message}`,
      );
      return {};
    }
  }
}
