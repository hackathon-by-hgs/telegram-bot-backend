import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { ReferralsResponseDto } from './dto/referrals.dto';

@ApiTags('referrals')
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get(':userId')
  @ApiOperation({
    summary: 'List referrals attributed to a user',
    description:
      'Returns every `Referral` record where the user is the referrer, plus a total count. Each row hydrates a thin view of the referred user (`username`, `createdAt`).',
  })
  @ApiParam({ name: 'userId', description: 'User ID (CUID)', example: 'ckxk7g2v90000abcd1234efgh' })
  @ApiOkResponse({ type: ReferralsResponseDto })
  forUser(@Param('userId') userId: string) {
    return this.referrals.forUser(userId);
  }
}
