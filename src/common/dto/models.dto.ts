import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserStatsDto {
  @ApiProperty({
    description: 'Foreign key to the owning user',
    example: 'ckxk7g2v90000abcd1234efgh',
  })
  userId!: string;

  @ApiProperty({ description: 'Total XP earned', example: 1250, minimum: 0 })
  xp!: number;

  @ApiProperty({
    description: 'Current daily streak (consecutive days active)',
    example: 7,
    minimum: 0,
  })
  streak!: number;

  @ApiProperty({
    description: 'Computed level from XP',
    example: 4,
    minimum: 1,
  })
  level!: number;

  @ApiProperty({
    description: 'Badge keys earned by the user',
    example: ['DAILY_GRINDER', 'VERIFIED_EXPLORER'],
    type: [String],
  })
  badges!: string[];

  @ApiProperty({
    description: 'Last time the user took an XP-earning action (ISO-8601)',
    example: '2026-05-27T21:42:00.000Z',
  })
  lastActiveAt!: string;
}

export class UserDto {
  @ApiProperty({
    description: 'Internal CUID',
    example: 'ckxk7g2v90000abcd1234efgh',
  })
  id!: string;

  @ApiProperty({
    description: 'Telegram numeric user ID, stringified',
    example: '123456789',
  })
  telegramId!: string;

  @ApiPropertyOptional({
    description: 'Telegram @username (without @)',
    example: 'satoshi',
    nullable: true,
  })
  username!: string | null;

  @ApiPropertyOptional({
    description: 'EVM wallet address (lowercased)',
    example: '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
    nullable: true,
  })
  walletAddress!: string | null;

  @ApiProperty({
    description: 'Short opaque referral code',
    example: 'A1B2C3D4',
  })
  referralCode!: string;

  @ApiPropertyOptional({
    description: 'ID of the user who referred this user, if any',
    example: 'ckxk7g2v90001abcd1234efgh',
    nullable: true,
  })
  referredById!: string | null;

  @ApiProperty({
    description: 'When the user was first seen (ISO-8601)',
    example: '2026-05-20T10:00:00.000Z',
  })
  createdAt!: string;
}

export class UserWithStatsDto extends UserDto {
  @ApiPropertyOptional({ type: () => UserStatsDto, nullable: true })
  stats?: UserStatsDto | null;
}

export class AirdropDto {
  @ApiProperty({ example: 'ckxk7g2v90100abcd1234efgh' })
  id!: string;

  @ApiProperty({
    description: 'Source-scoped external identifier (unique)',
    example: 'cryptorank:zksync-launch',
  })
  externalId!: string;

  @ApiProperty({ example: 'zkSync Airdrop' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Long-form description of the campaign.',
    nullable: true,
  })
  description!: string | null;

  @ApiPropertyOptional({ example: '$50-$500', nullable: true })
  rewardEstimate!: string | null;

  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.000Z', nullable: true })
  deadline!: string | null;

  @ApiPropertyOptional({ example: 'L2', nullable: true })
  category!: string | null;

  @ApiPropertyOptional({
    description:
      'Cached trust score (0-100) from the most recent SecurityReport',
    example: 78,
    minimum: 0,
    maximum: 100,
    nullable: true,
  })
  trustScore!: number | null;

  @ApiPropertyOptional({ example: 'medium', nullable: true })
  difficulty!: string | null;

  @ApiPropertyOptional({
    description: 'Canonical project/campaign link',
    example: 'https://www.coingecko.com/en/coins/zksync',
    nullable: true,
  })
  projectUrl!: string | null;

  @ApiProperty({
    description: 'Free-form social/contract links (key → URL)',
    example: { twitter: 'https://x.com/zksync', website: 'https://zksync.io' },
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  socialLinks!: Record<string, string>;

  @ApiProperty({ description: 'Origin aggregator name', example: 'cryptorank' })
  source!: string;

  @ApiProperty({ example: '2026-05-20T10:00:00.000Z' })
  createdAt!: string;
}

export class AirdropTaskDto {
  @ApiProperty({ example: 'ckxk7g2v90200abcd1234efgh' })
  id!: string;

  @ApiProperty({
    description: 'FK to Airdrop',
    example: 'ckxk7g2v90100abcd1234efgh',
  })
  airdropId!: string;

  @ApiProperty({
    description: 'FK to User',
    example: 'ckxk7g2v90000abcd1234efgh',
  })
  userId!: string;

  @ApiProperty({ example: 'Bridge funds to L2' })
  label!: string;

  @ApiProperty({
    description: 'Lifecycle status',
    enum: ['pending', 'in_progress', 'completed'],
    example: 'in_progress',
  })
  status!: 'pending' | 'in_progress' | 'completed';

  @ApiProperty({
    description: 'Progress %, 0-100',
    example: 40,
    minimum: 0,
    maximum: 100,
  })
  progress!: number;

  @ApiPropertyOptional({ example: '2026-05-25T12:34:56.000Z', nullable: true })
  completedAt!: string | null;

  @ApiProperty({ example: '2026-05-20T10:00:00.000Z' })
  createdAt!: string;
}

export class HealthDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'swiftydrop-guard-backend' })
  service!: string;

  @ApiProperty({
    description: 'ISO-8601 timestamp',
    example: '2026-05-27T21:42:00.000Z',
  })
  ts!: string;
}

export class DependencyCheckDto {
  @ApiProperty({
    description: 'Whether the dependency answered',
    enum: ['up', 'down'],
    example: 'up',
  })
  status!: 'up' | 'down';

  @ApiPropertyOptional({
    description: 'Error message when the dependency is down',
    example: 'connection refused',
    nullable: true,
  })
  error?: string;
}

export class ReadinessChecksDto {
  @ApiProperty({
    type: () => DependencyCheckDto,
    description: 'PostgreSQL reachability (SELECT 1)',
  })
  database!: DependencyCheckDto;
}

export class ReadinessDto {
  @ApiProperty({
    description: "'ok' when every dependency is up, otherwise 'degraded'",
    enum: ['ok', 'degraded'],
    example: 'ok',
  })
  status!: string;

  @ApiProperty({
    description: 'True only when the service can fully serve traffic',
    example: true,
  })
  ready!: boolean;

  @ApiProperty({ example: 'swiftydrop-guard-backend' })
  service!: string;

  @ApiProperty({ type: () => ReadinessChecksDto })
  checks!: ReadinessChecksDto;

  @ApiProperty({
    description: 'ISO-8601 timestamp',
    example: '2026-05-27T21:42:00.000Z',
  })
  ts!: string;
}
