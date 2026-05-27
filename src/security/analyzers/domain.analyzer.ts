import { Signal } from '../types';

const PHISHING_PATTERNS = [
  /-?(claim|airdrop|verify|wallet|connect|reward|bonus)-?/i,
  /\bxn--/, // punycode IDN homograph
  /[0-9]{4,}/,
  /(metarnask|binnance|opensea-?reward|uniswap-?gift)/i,
];

const TRUSTED_TLDS = ['.org', '.com', '.io', '.xyz'];

export function analyzeDomain(domain?: string): Signal[] {
  if (!domain) return [];
  const signals: Signal[] = [];
  const lower = domain.toLowerCase();

  for (const re of PHISHING_PATTERNS) {
    if (re.test(lower)) {
      signals.push({
        source: 'domain',
        positive: 0,
        negative: 0.7,
        warning: `Domain matches phishing pattern: ${re}`,
      });
      break;
    }
  }

  if (lower.length > 35) {
    signals.push({ source: 'domain', positive: 0, negative: 0.3, warning: 'Unusually long domain' });
  }

  if (TRUSTED_TLDS.some((t) => lower.endsWith(t))) {
    signals.push({ source: 'domain', positive: 0.2, negative: 0, detail: 'Common TLD' });
  }

  // Subdomain depth signal — phishing often uses 4+ levels (e.g. uniswap.gift.airdrop.tld)
  if (lower.split('.').length >= 4) {
    signals.push({ source: 'domain', positive: 0, negative: 0.4, warning: 'Deep subdomain nesting' });
  }
  return signals;
}
