import { Controller, Get, Param } from '@nestjs/common';
import { ReferralsService } from './referrals.service';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get(':userId')
  forUser(@Param('userId') userId: string) {
    return this.referrals.forUser(userId);
  }
}
