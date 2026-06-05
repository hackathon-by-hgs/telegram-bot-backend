export interface NormalizedAirdrop {
  externalId: string; // "${source}:${slug}" — idempotency key
  name: string;
  description?: string;
  rewardEstimate?: string;
  deadline?: Date;
  category?: string;
  difficulty?: string;
  socialLinks?: Record<string, string>;
  source: string;
}

export interface AirdropSource {
  readonly name: string;
  fetch(): Promise<NormalizedAirdrop[]>;
}
