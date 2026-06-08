import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export const SWIFTYEX_WEBHOOK_EVENTS = ['deposit', 'kyc_upgraded'] as const;
export type SwiftyExWebhookEvent = (typeof SWIFTYEX_WEBHOOK_EVENTS)[number];

export const SWIFTYEX_WALLET_TYPES = [
  'btc',
  'ethereum',
  'usdt',
  'naira',
] as const;
export type SwiftyExWalletType = (typeof SWIFTYEX_WALLET_TYPES)[number];

/**
 * Base body for every authenticated SwiftyEx call.
 * `initData` is the raw Telegram Mini App init string. Leave empty to use the
 * SwiftyEx DEBUG bypass (returns the first Chat) in local dev.
 */
export class SwiftyExAuthDto {
  @ApiPropertyOptional({
    description:
      'Raw Telegram Mini App initData string. Empty triggers the SwiftyEx DEBUG bypass in local dev.',
    example: '',
    default: '',
  })
  @IsOptional()
  @IsString()
  initData?: string;
}

export class SwiftyExTransactionsDto extends SwiftyExAuthDto {
  @ApiPropertyOptional({
    description: 'Page number (20 per page).',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Filter by wallet type. Omit for all wallets.',
    enum: SWIFTYEX_WALLET_TYPES,
    example: 'usdt',
  })
  @IsOptional()
  @IsIn(SWIFTYEX_WALLET_TYPES)
  wallet_type?: SwiftyExWalletType;
}

// --- Response shapes (documentation only; SwiftyEx is the source of truth) ---

export class SwiftyExMeDto {
  @ApiProperty({ example: '123456789' }) chat_id!: string;
  @ApiPropertyOptional({ example: 'satoshi' }) username?: string;
  @ApiPropertyOptional({ example: 'Satoshi' }) first_name?: string;
  @ApiProperty({ example: true }) kyc_verified!: boolean;
  @ApiProperty({ example: 2 }) kyc_level!: number;
  @ApiPropertyOptional({ example: 'A1B2C3' }) referral_code?: string;
}

export class SwiftyExWalletDto {
  @ApiProperty({ enum: SWIFTYEX_WALLET_TYPES, example: 'usdt' })
  wallet_type!: string;
  @ApiProperty({ example: 'tron' }) blockchain!: string;
  @ApiProperty({ example: '125.40' }) balance!: string;
  @ApiProperty({ example: 'TXxx…' }) address!: string;
}

/**
 * Inbound webhook from SwiftyEx for real-time deposit / KYC changes.
 * Authenticated by the `x-swiftyex-secret` header (must match SWIFTYEX_WEBHOOK_SECRET).
 */
export class SwiftyExWebhookDto {
  @ApiProperty({ enum: SWIFTYEX_WEBHOOK_EVENTS, example: 'deposit' })
  @IsIn(SWIFTYEX_WEBHOOK_EVENTS)
  event!: SwiftyExWebhookEvent;

  @ApiProperty({ description: 'SwiftyEx chat_id (== our User.telegramId).', example: '123456789' })
  @IsString()
  @IsNotEmpty()
  chat_id!: string;

  @ApiPropertyOptional({ description: 'Asset for a deposit event.', example: 'usdt' })
  @IsOptional()
  @IsString()
  asset?: string;

  @ApiPropertyOptional({ description: 'Credited amount for a deposit event.', example: 25.5 })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ description: 'New KYC level for a kyc_upgraded event.', example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  kyc_level?: number;
}

export class SwiftyExRateDto {
  @ApiProperty({ example: 'btc' }) asset!: string;
  @ApiProperty({ example: 98000.5 }) buyRate!: number;
  @ApiProperty({ example: 97500.0 }) sellRate!: number;
}
