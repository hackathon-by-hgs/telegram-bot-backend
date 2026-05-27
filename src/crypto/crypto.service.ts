import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface CachedPrice {
  value: number;
  fetchedAt: number;
}

@Injectable()
export class CryptoService {
  private readonly log = new Logger(CryptoService.name);
  private readonly cache = new Map<string, CachedPrice>();
  private readonly TTL_MS = 60_000;

  constructor(private readonly http: HttpService) {}

  async price(coinId: string, vsCurrency = 'usd'): Promise<number | null> {
    const key = `${coinId}:${vsCurrency}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.fetchedAt < this.TTL_MS) return hit.value;

    try {
      const { data } = await firstValueFrom(
        this.http.get('https://api.coingecko.com/api/v3/simple/price', {
          params: { ids: coinId, vs_currencies: vsCurrency },
          timeout: 6000,
        }),
      );
      const value = data?.[coinId]?.[vsCurrency];
      if (typeof value === 'number') {
        this.cache.set(key, { value, fetchedAt: Date.now() });
        return value;
      }
      return null;
    } catch (err) {
      this.log.warn(`coingecko price fetch failed: ${(err as Error).message}`);
      return hit?.value ?? null; // serve stale on failure (graceful degradation)
    }
  }

  async trending(): Promise<Array<{ id: string; name: string; symbol: string }>> {
    try {
      const { data } = await firstValueFrom(
        this.http.get('https://api.coingecko.com/api/v3/search/trending', { timeout: 6000 }),
      );
      return (data?.coins ?? []).map((c: any) => ({
        id: c.item.id,
        name: c.item.name,
        symbol: c.item.symbol,
      }));
    } catch {
      return [];
    }
  }
}
