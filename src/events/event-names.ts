// Single source of truth for cross-module events (spec §5).
export const EVENTS = {
  AIRDROP_CREATED: 'airdrop.created',
  AIRDROP_FLAGGED: 'airdrop.flagged',
  WALLET_RISK_DETECTED: 'wallet.risk_detected',
  TASK_COMPLETED: 'task.completed',
  USER_SIGNUP: 'user.signup',
  REFERRAL_COMPLETED: 'referral.completed',

  // SwiftyEx exchange integration
  SWIFTYEX_LINKED: 'swiftyex.linked', // first successful sync for a user
  SWIFTYEX_DEPOSIT_CONFIRMED: 'swiftyex.deposit_confirmed',
  SWIFTYEX_KYC_UPGRADED: 'swiftyex.kyc_upgraded',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
