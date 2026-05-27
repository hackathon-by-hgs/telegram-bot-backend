import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ReferredUserSummaryDto {
  @ApiPropertyOptional({ example: 'satoshi', nullable: true })
  username!: string | null;

  @ApiProperty({ example: '2026-05-20T10:00:00.000Z' })
  createdAt!: string;
}

export class ReferralDto {
  @ApiProperty({ example: 'ckxk7g2v90300abcd1234efgh' })
  id!: string;

  @ApiProperty({ description: 'User who owns the referral code.', example: 'ckxk7g2v90000abcd1234efgh' })
  referrerId!: string;

  @ApiProperty({ description: 'User who signed up via the code.', example: 'ckxk7g2v90001abcd1234efgh' })
  referredUserId!: string;

  @ApiProperty({ description: 'Whether the XP reward for this referral has been granted.', example: true })
  rewardGranted!: boolean;

  @ApiProperty({ example: '2026-05-21T11:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ type: () => ReferredUserSummaryDto })
  referredUser!: ReferredUserSummaryDto;
}

export class ReferralsResponseDto {
  @ApiProperty({ description: 'Number of referrals attributed to this user.', example: 3, minimum: 0 })
  count!: number;

  @ApiProperty({ type: [ReferralDto] })
  referrals!: ReferralDto[];
}
