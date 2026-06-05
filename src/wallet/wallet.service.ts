import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { firstValueFrom } from 'rxjs';
import { EVENTS } from '../events/event-names';

const MAX_UINT256 = BigInt(
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
);
const FLAGGED_CONTRACTS: ReadonlySet<string> = new Set([
  // Public phishing/exploit honeypots — extend via env / DB in real deploy.
  '0x0000000000000000000000000000000000000000',
]);

export interface WalletAnalysis {
  wallet_health_score: number;
  risk_indicators: string[];
  dangerous_approvals: Array<{ token: string; spender: string }>;
  suspicious_contracts: string[];
  recommendations: string[];
}

@Injectable()
export class WalletService {
  private readonly log = new Logger(WalletService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  async analyze(address: string, chain = 'eth'): Promise<WalletAnalysis> {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new Error('Invalid wallet address');
    }

    const [txs, approvals] = await Promise.all([
      this.fetchRecentTxs(address, chain),
      this.fetchApprovals(address, chain),
    ]);

    const risk_indicators: string[] = [];
    const suspicious_contracts: string[] = [];

    for (const tx of txs) {
      if (FLAGGED_CONTRACTS.has((tx.to ?? '').toLowerCase())) {
        suspicious_contracts.push(tx.to);
        risk_indicators.push(`Interaction with flagged contract ${tx.to}`);
      }
    }

    const dangerous_approvals = approvals.filter((a) => a.value === 'max');
    if (dangerous_approvals.length) {
      risk_indicators.push(
        `${dangerous_approvals.length} unlimited approval(s) outstanding`,
      );
    }

    // Health: start at 100, deduct per indicator. Cap at 0.
    const wallet_health_score = Math.max(
      0,
      100 - dangerous_approvals.length * 10 - suspicious_contracts.length * 20,
    );

    if (wallet_health_score < 60) {
      this.events.emit(EVENTS.WALLET_RISK_DETECTED, {
        address,
        score: wallet_health_score,
      });
    }

    return {
      wallet_health_score,
      risk_indicators,
      dangerous_approvals,
      suspicious_contracts,
      recommendations: this.recommend(
        dangerous_approvals.length,
        suspicious_contracts.length,
      ),
    };
  }

  private recommend(approvals: number, badContracts: number) {
    const r: string[] = [];
    if (approvals > 0)
      r.push('Revoke unlimited token approvals via revoke.cash');
    if (badContracts > 0)
      r.push(
        'Move funds to a fresh wallet — current address has been exposed to flagged contracts',
      );
    if (r.length === 0)
      r.push(
        'Wallet appears clean. Continue practicing good approval hygiene.',
      );
    return r;
  }

  private async fetchRecentTxs(address: string, chain: string) {
    const apiKey = this.config.get<string>('ETHERSCAN_API_KEY');
    if (!apiKey) return [] as Array<{ to: string }>;
    const base =
      chain === 'bsc'
        ? 'https://api.bscscan.com/api'
        : 'https://api.etherscan.io/api';
    try {
      const { data } = await firstValueFrom(
        this.http.get(base, {
          params: {
            module: 'account',
            action: 'txlist',
            address,
            sort: 'desc',
            page: 1,
            offset: 50,
            apikey: apiKey,
          },
          timeout: 8000,
        }),
      );
      return (data?.result ?? []) as Array<{ to: string }>;
    } catch (err) {
      this.log.warn(`etherscan tx fetch failed: ${(err as Error).message}`);
      return [];
    }
  }

  private async fetchApprovals(
    address: string,
    _chain: string,
  ): Promise<Array<{ token: string; spender: string; value: 'max' | string }>> {
    // Approval log fetching is API-heavy; we expose the interface and return empty when
    // no provider is configured. Plug in Moralis/Alchemy "getTokenApprovals" here.
    const moralisKey = this.config.get<string>('MORALIS_API_KEY');
    if (!moralisKey) return [];
    try {
      const { data } = await firstValueFrom(
        this.http.get(
          `https://deep-index.moralis.io/api/v2.2/wallets/${address}/approvals`,
          {
            headers: { 'X-API-Key': moralisKey },
            timeout: 8000,
          },
        ),
      );
      const list: any[] = data?.result ?? [];
      return list.map((row) => ({
        token: row.token_address,
        spender: row.spender_address,
        value:
          BigInt(row.value ?? 0) >= MAX_UINT256
            ? 'max'
            : String(row.value ?? 0),
      }));
    } catch (err) {
      this.log.warn(
        `moralis approvals fetch failed: ${(err as Error).message}`,
      );
      return [];
    }
  }
}
