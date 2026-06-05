import { RiskLevel, SecurityReportOutput, Signal } from './types';

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

// Aggregation produces independent trust + scam scores from the same signals.
// Caps at 100 — five 0.3-negative signals = 100% scam, intentionally aggressive.
export function aggregate(signals: Signal[]): SecurityReportOutput {
  const trustRaw = signals.reduce((acc, s) => acc + s.positive, 0);
  const scamRaw = signals.reduce((acc, s) => acc + s.negative, 0);

  const trust_score = clamp(Math.round(trustRaw * 50)); // each +1 of positive ≈ +50
  const scam_probability = clamp(Math.round(scamRaw * 35)); // each +1 of negative ≈ +35
  const risk_level = bandRisk(scam_probability);
  const warnings = signals.map((s) => s.warning).filter(Boolean) as string[];

  return {
    trust_score,
    scam_probability,
    risk_level,
    warnings,
    recommendation: pickRecommendation(risk_level),
    explanation: explain(signals, trust_score, scam_probability),
  };
}

function bandRisk(scam: number): RiskLevel {
  if (scam >= 60) return 'high';
  if (scam >= 30) return 'medium';
  return 'low';
}

function pickRecommendation(risk: RiskLevel) {
  switch (risk) {
    case 'high':
      return 'Avoid — high indicators of fraud detected.';
    case 'medium':
      return 'Proceed with caution — verify on multiple sources first.';
    default:
      return 'Looks safe based on available signals — always self-verify before connecting wallet.';
  }
}

function explain(signals: Signal[], trust: number, scam: number) {
  if (signals.length === 0)
    return 'Insufficient data to produce a confident assessment.';
  const top = signals
    .map((s) => s.warning ?? s.detail)
    .filter(Boolean)
    .slice(0, 4)
    .join('; ');
  return `Trust ${trust}/100, scam likelihood ${scam}%. Key findings: ${top || 'no notable findings'}.`;
}
