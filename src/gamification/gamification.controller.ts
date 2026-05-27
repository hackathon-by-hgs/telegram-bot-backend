import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { GamificationService } from './gamification.service';

@Controller()
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  // GET /user/stats?userId=...
  @Get('user/stats')
  stats(@Query('userId') userId: string) {
    return this.gamification.stats(userId);
  }

  // POST /user/xp/update — manual admin/debug grant.
  @Post('user/xp/update')
  addXp(@Body('userId') userId: string, @Body('amount') amount: number) {
    return this.gamification.addXp(userId, Number(amount) || 0, 'manual');
  }

  @Get('leaderboard')
  leaderboard(@Query('limit') limit?: string) {
    return this.gamification.leaderboard(limit ? parseInt(limit, 10) : 20);
  }
}
