import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export const SUPPORTED_CHAINS = ['eth', 'bsc', 'polygon', 'arbitrum', 'optimism', 'base'] as const;
export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

export class WalletConnectDto {
  @ApiProperty({ description: 'User ID (CUID)', example: 'ckxk7g2v90000abcd1234efgh' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    description: 'EVM wallet address (0x-prefixed). Bridged from the Telegram Mini App; production deployments should also verify a WalletConnect signature.',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0BEb0',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'address must be a valid 0x-prefixed EVM address' })
  address!: string;
}

export class WalletAnalysisQueryDto {
  @ApiPropertyOptional({
    description: 'Chain identifier; defaults to `eth` if omitted.',
    enum: SUPPORTED_CHAINS,
    example: 'eth',
    default: 'eth',
  })
  @IsOptional()
  @IsIn(SUPPORTED_CHAINS as unknown as string[])
  chain?: SupportedChain;
}

export class DangerousApprovalDto {
  @ApiProperty({ description: 'Token contract address', example: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' })
  token!: string;

  @ApiProperty({ description: 'Spender address granted unlimited allowance', example: '0xabcdef0123456789abcdef0123456789abcdef01' })
  spender!: string;
}

export class WalletAnalysisDto {
  @ApiProperty({
    description: 'Composite wallet health (0-100). Higher is healthier.',
    example: 72,
    minimum: 0,
    maximum: 100,
  })
  wallet_health_score!: number;

  @ApiProperty({
    description: 'Human-readable risk indicators surfaced by heuristics.',
    example: ['unlimited_approvals_detected'],
    type: [String],
  })
  risk_indicators!: string[];

  @ApiProperty({
    description: 'Open infinite/large approvals.',
    type: [DangerousApprovalDto],
  })
  dangerous_approvals!: DangerousApprovalDto[];

  @ApiProperty({
    description: 'Contract addresses present in a known phishing/exploit list.',
    example: [],
    type: [String],
  })
  suspicious_contracts!: string[];

  @ApiProperty({
    description: 'Actionable user-facing recommendations.',
    example: ['Revoke unlimited approvals for token 0x1f98… on Etherscan'],
    type: [String],
  })
  recommendations!: string[];
}
