import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GamificationService } from './gamification.service';
import { AddXpDto, LeaderboardEntryDto, StatsQueryDto } from './dto/gamification.dto';
import { UserStatsDto } from '../common/dto/models.dto';

@ApiTags('gamification')
@Controller()
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('user/stats')
  @ApiOperation({
    summary: 'Fetch a user’s gamification stats',
    description: 'Returns `UserStats` (xp, level, streak, badges, lastActiveAt). Returns 200 with `null` if the user has no stats row yet.',
  })
  @ApiOkResponse({ type: UserStatsDto, description: 'May be `null` if the user has not earned any XP yet.' })
  stats(@Query() query: StatsQueryDto) {
    return this.gamification.stats(query.userId);
  }

  @Post('user/xp/update')
  @ApiOperation({
    summary: 'Grant XP to a user',
    description:
      'Adds (or subtracts) XP, recomputes level and streak, and awards badges as thresholds are crossed: ' +
      '`DAILY_GRINDER` (7-day streak), `SECURITY_EXPERT` (level 10), `VERIFIED_EXPLORER` (1 completed task), `AIRDROP_MASTER` (25 completed tasks). ' +
      'Typically called internally via the `TASK_COMPLETED` event listener — direct use is for admin/debug.',
  })
  @ApiOkResponse({ type: UserStatsDto })
  addXp(@Body() dto: AddXpDto) {
    return this.gamification.addXp(dto.userId, Number(dto.amount) || 0, 'manual');
  }

  @Get('leaderboard')
  @ApiOperation({
    summary: 'XP leaderboard',
    description: 'Top users by XP (descending), ties broken by streak. Each row includes a thin user summary (`username`, `referralCode`).',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Max rows (default 20, max 200).' })
  @ApiOkResponse({ type: [LeaderboardEntryDto] })
  leaderboard(@Query('limit') limit?: string) {
    return this.gamification.leaderboard(limit ? parseInt(limit, 10) : 20);
  }
}
