import { Signal, AnalysisInput } from '../types';

/**
 * Cheap, no-network heuristics covering the remaining spec modules:
 *   - Liquidity analysis (locked/unlocked, volume anomalies)
 *   - Ownership analysis (concentration, renounced)
 *   - Social authenticity (fake engagement heuristics)
 *
 * Inputs come from the caller (whoever already pulled token/wallet info upstream)
 * which keeps these analyzers cheap and synchronous — useful when batching
 * across many airdrops in the cron re-evaluation job.
 */

export function analyzeLiquidity(token?: Record<string, unknown>): Signal[] {
  if (!token) return [];
  const out: Signal[] = [];
  const liqLocked = Boolean(token.liquidityLocked);
  const liqUsd = Number(token.liquidityUsd ?? 0);
  const volume24h = Number(token.volume24h ?? 0);

  if (liqLocked) out.push({ source: 'liquidity', positive: 0.4, negative: 0, detail: 'Liquidity locked' });
  else if (liqUsd > 0)
    out.push({ source: 'liquidity', positive: 0, negative: 0.5, warning: 'Liquidity unlocked' });

  // Volume anomaly: > 5x liquidity in a single day = wash trading suspicion.
  if (liqUsd > 0 && volume24h > liqUsd * 5) {
    out.push({ source: 'liquidity', positive: 0, negative: 0.4, warning: 'Suspicious volume/liquidity ratio' });
  }
  return out;
}

export function analyzeOwnership(token?: Record<string, unknown>): Signal[] {
  if (!token) return [];
  const out: Signal[] = [];
  const topHolderPct = Number(token.topHolderPct ?? 0);
  const renounced = Boolean(token.ownershipRenounced);

  if (renounced) out.push({ source: 'ownership', positive: 0.4, negative: 0, detail: 'Ownership renounced' });
  if (topHolderPct >= 50)
    out.push({
      source: 'ownership',
      positive: 0,
      negative: 0.7,
      warning: `Top holder controls ${topHolderPct}% of supply`,
    });
  else if (topHolderPct >= 25)
    out.push({
      source: 'ownership',
      positive: 0,
      negative: 0.3,
      warning: `High holder concentration (${topHolderPct}%)`,
    });

  return out;
}

export function analyzeSocial(links?: AnalysisInput['socialLinks']): Signal[] {
  if (!links) return [];
  const out: Signal[] = [];
  const count = Object.keys(links).length;
  if (count === 0) {
    out.push({ source: 'social', positive: 0, negative: 0.3, warning: 'No social presence' });
  } else if (count >= 3) {
    out.push({ source: 'social', positive: 0.2, negative: 0, detail: 'Multi-channel social presence' });
  }

  // Spec hint: fake engagement detection. Without API access we flag suspicious patterns
  // in the URL itself (e.g. very new t.me handles ending in numbers).
  for (const [k, url] of Object.entries(links)) {
    if (/t\.me\/[a-z]+[0-9]{4,}$/i.test(url)) {
      out.push({
        source: 'social',
        positive: 0,
        negative: 0.2,
        warning: `${k} handle pattern suggests throwaway account`,
      });
    }
  }
  return out;
}
