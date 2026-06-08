// Badge IDs from spec §2.8. Earning logic lives in GamificationService.
export const BADGES = {
  SCAM_HUNTER: 'scam_hunter',
  VERIFIED_EXPLORER: 'verified_explorer',
  AIRDROP_MASTER: 'airdrop_master',
  DAILY_GRINDER: 'daily_grinder',
  SECURITY_EXPERT: 'security_expert',
  EXCHANGE_LINKED: 'exchange_linked', // connected a SwiftyEx account
  KYC_VERIFIED: 'kyc_verified', // completed SwiftyEx KYC
} as const;

export type BadgeId = (typeof BADGES)[keyof typeof BADGES];
