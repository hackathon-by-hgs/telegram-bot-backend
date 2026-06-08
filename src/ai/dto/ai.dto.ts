import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const RISK = ['low', 'medium', 'high'] as const;

export class SetPreferencesDto {
  @ApiProperty({ description: 'User ID (CUID).', example: 'ckxk7g2v90000abcd1234efgh' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiPropertyOptional({ type: [String], example: ['defi', 'gaming'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ type: [String], example: ['ethereum', 'solana'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chains?: string[];

  @ApiPropertyOptional({ enum: RISK, example: 'medium' })
  @IsOptional()
  @IsIn(RISK)
  riskTolerance?: (typeof RISK)[number];

  @ApiPropertyOptional({ enum: RISK, example: 'low' })
  @IsOptional()
  @IsIn(RISK)
  effort?: (typeof RISK)[number];
}

export class RecommendDto {
  @ApiProperty({ description: 'User ID (CUID).', example: 'ckxk7g2v90000abcd1234efgh' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiPropertyOptional({ description: 'Max recommendations to return.', default: 10, example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
