import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, Matches } from 'class-validator';
import { SUPPORTED_CHAINS, type SupportedChain } from '../../wallet/dto/wallet.dto';

export const RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type RiskLevelDto = (typeof RISK_LEVELS)[number];

export class AnalyzeAirdropDto {
  @ApiPropertyOptional({
    description: 'Project domain. Used for WHOIS / SSL / phishing-list checks.',
    example: 'zksync.io',
  })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({
    description: 'Token / project contract address.',
    example: '0x32400084c286cf3e17e7b677ea9583e60a000324',
  })
  @IsOptional()
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'contractAddress must be a valid 0x-prefixed EVM address' })
  contractAddress?: string;

  @ApiPropertyOptional({
    enum: SUPPORTED_CHAINS,
    example: 'eth',
    description: 'Chain hint for the contract lookup.',
  })
  @IsOptional()
  @IsIn(SUPPORTED_CHAINS as unknown as string[])
  chain?: SupportedChain;

  @ApiPropertyOptional({
    description:
      'Free-form token metadata (holder distribution, top-holder pct, etc.). Forwarded to GoPlus / heuristics.',
    type: 'object',
    additionalProperties: true,
    example: { holders: 1240, topHolderPct: 12.4 },
  })
  @IsOptional()
  @IsObject()
  tokenInfo?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Optional on-chain behaviour summary for the contract deployer.',
    type: 'object',
    additionalProperties: true,
    example: { txCount: 832, ageDays: 412 },
  })
  @IsOptional()
  @IsObject()
  walletBehavior?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Project social links (key → URL).',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { twitter: 'https://x.com/zksync', discord: 'https://discord.gg/zksync' },
  })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  @ApiPropertyOptional({
    description:
      'When provided, the SecurityReport is denormalized onto the Airdrop (`trustScore` field) and a high-risk verdict emits `AIRDROP_FLAGGED`.',
    example: 'ckxk7g2v90100abcd1234efgh',
  })
  @IsOptional()
  @IsString()
  airdropId?: string;
}

export class AnalyzeWalletDto {
  @ApiProperty({
    description: 'EVM wallet address to analyse.',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0BEb0',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'address must be a valid 0x-prefixed EVM address' })
  address!: string;

  @ApiPropertyOptional({ enum: SUPPORTED_CHAINS, example: 'eth', default: 'eth' })
  @IsOptional()
  @IsIn(SUPPORTED_CHAINS as unknown as string[])
  chain?: SupportedChain;
}

export class SecurityReportOutputDto {
  @ApiProperty({ description: 'Composite trust score 0-100.', example: 78, minimum: 0, maximum: 100 })
  trust_score!: number;

  @ApiProperty({ description: 'Composite scam probability 0-100.', example: 14, minimum: 0, maximum: 100 })
  scam_probability!: number;

  @ApiProperty({ enum: RISK_LEVELS, example: 'low' })
  risk_level!: RiskLevelDto;

  @ApiProperty({
    description: 'Concrete red-flag findings.',
    example: ['contract_not_verified'],
    type: [String],
  })
  warnings!: string[];

  @ApiProperty({
    description: 'One-line guidance for the end user.',
    example: 'Looks legitimate. Proceed with caution; never approve unlimited spend.',
  })
  recommendation!: string;

  @ApiProperty({
    description: 'Long-form explanation citing each signal.',
    example: 'Domain registered 412 days ago, contract verified on Etherscan, 12k+ unique holders…',
  })
  explanation!: string;
}
