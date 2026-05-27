// Single source of truth for cross-module events (spec §5).
export const EVENTS = {
  AIRDROP_CREATED: 'airdrop.created',
  AIRDROP_FLAGGED: 'airdrop.flagged',
  WALLET_RISK_DETECTED: 'wallet.risk_detected',
  TASK_COMPLETED: 'task.completed',
  USER_SIGNUP: 'user.signup',
  REFERRAL_COMPLETED: 'referral.completed',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
