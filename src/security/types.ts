export type RiskLevel = 'low' | 'medium' | 'high';

export interface SecurityReportOutput {
  trust_score: number; // 0-100
  scam_probability: number; // 0-100
  risk_level: RiskLevel;
  warnings: string[];
  recommendation: string;
  explanation: string;
}

export interface AnalysisInput {
  domain?: string;
  contractAddress?: string;
  chain?: string; // eth | bsc | polygon | ...
  tokenInfo?: Record<string, unknown>;
  walletBehavior?: Record<string, unknown>;
  socialLinks?: Record<string, string>;
}

export interface Signal {
  source: string;
  positive: number; // 0-1, contributes to trust
  negative: number; // 0-1, contributes to scam
  warning?: string;
  detail?: string;
}
