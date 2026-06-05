import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PriceQueryDto {
  @ApiPropertyOptional({
    description: 'Quote currency (CoinGecko `vs_currency`). Defaults to `usd`.',
    example: 'usd',
    default: 'usd',
  })
  @IsOptional()
  @IsString()
  vs?: string;
}

export class PriceResponseDto {
  @ApiProperty({
    description: 'CoinGecko coin id (echoed back).',
    example: 'ethereum',
  })
  id!: string;

  @ApiProperty({ description: 'Quote currency (echoed back).', example: 'usd' })
  vs!: string;

  @ApiProperty({
    description: 'Quoted price, or null on upstream failure.',
    example: 3245.12,
    nullable: true,
    type: Number,
  })
  value!: number | null;
}

export class TrendingCoinDto {
  @ApiProperty({ example: 'pepe' })
  id!: string;

  @ApiProperty({ example: 'Pepe' })
  name!: string;

  @ApiProperty({ example: 'PEPE' })
  symbol!: string;
}
