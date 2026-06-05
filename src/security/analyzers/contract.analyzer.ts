import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Signal } from '../types';

/**
 * Pulls signals from the GoPlus token-security endpoint:
 *   https://api.gopluslabs.io/api/v1/token_security/{chain_id}?contract_addresses=...
 * GoPlus returns boolean-ish flags as "0"/"1" strings. We turn them into normalized signals.
 */
@Injectable()
export class ContractAnalyzer {
  private readonly log = new Logger(ContractAnalyzer.name);
  // Chain string -> GoPlus chain id
  private static readonly CHAIN_IDS: Record<string, string> = {
    eth: '1',
    bsc: '56',
    polygon: '137',
    arbitrum: '42161',
    base: '8453',
  };

  constructor(private readonly http: HttpService) {}

  async analyze(contractAddress?: string, chain = 'eth'): Promise<Signal[]> {
    if (!contractAddress) return [];
    const chainId = ContractAnalyzer.CHAIN_IDS[chain];
    if (!chainId) return [];

    try {
      const { data } = await firstValueFrom(
        this.http.get(
          `https://api.gopluslabs.io/api/v1/token_security/${chainId}`,
          {
            params: { contract_addresses: contractAddress.toLowerCase() },
            timeout: 6000,
          },
        ),
      );
      const info = data?.result?.[contractAddress.toLowerCase()];
      if (!info) return [];
      return this.mapGoPlus(info);
    } catch (err) {
      this.log.warn(`goplus failed: ${(err as Error).message}`);
      // Fail open with neutral signal — never block a request on a third-party.
      return [
        {
          source: 'contract',
          positive: 0,
          negative: 0.05,
          warning: 'Contract scan unavailable',
        },
      ];
    }
  }

  private mapGoPlus(info: Record<string, string>): Signal[] {
    const out: Signal[] = [];
    const truthy = (k: string) => info[k] === '1';

    if (truthy('is_honeypot')) {
      out.push({
        source: 'contract',
        positive: 0,
        negative: 1,
        warning: 'Honeypot detected',
      });
    }
    if (truthy('can_take_back_ownership')) {
      out.push({
        source: 'contract',
        positive: 0,
        negative: 0.6,
        warning: 'Owner can reclaim ownership',
      });
    }
    if (truthy('hidden_owner')) {
      out.push({
        source: 'contract',
        positive: 0,
        negative: 0.5,
        warning: 'Hidden owner',
      });
    }
    if (truthy('is_proxy')) {
      out.push({
        source: 'contract',
        positive: 0,
        negative: 0.2,
        warning: 'Proxy contract — upgradeable',
      });
    }
    if (truthy('is_open_source')) {
      out.push({
        source: 'contract',
        positive: 0.3,
        negative: 0,
        detail: 'Open source',
      });
    }
    if (truthy('is_mintable')) {
      out.push({
        source: 'contract',
        positive: 0,
        negative: 0.4,
        warning: 'Mintable supply',
      });
    }
    return out;
  }
}
