import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserStatsDto } from '../../common/dto/models.dto';

export class StatsQueryDto {
  @ApiProperty({
    description: 'User ID (CUID) to fetch stats for.',
    example: 'ckxk7g2v90000abcd1234efgh',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export class AddXpDto {
  @ApiProperty({ example: 'ckxk7g2v90000abcd1234efgh' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    description:
      'XP to add (may be negative to deduct). Recomputes level, streak and badges.',
    example: 50,
  })
  @Type(() => Number)
  @IsInt()
  @Min(-100000)
  @Max(100000)
  amount!: number;
}

export class LeaderboardQueryDto {
  @ApiPropertyOptional({
    description: 'Max rows to return. Defaults to 20.',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

class LeaderboardUserSummaryDto {
  @ApiProperty({ example: 'satoshi', nullable: true })
  username!: string | null;

  @ApiProperty({ example: 'A1B2C3D4' })
  referralCode!: string;
}

export class LeaderboardEntryDto extends UserStatsDto {
  @ApiProperty({ type: () => LeaderboardUserSummaryDto })
  user!: LeaderboardUserSummaryDto;
}
