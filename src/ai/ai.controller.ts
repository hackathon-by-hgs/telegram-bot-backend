import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ScamDetectorService } from './scam-detector.service';
import { RecommendationService } from './recommendation.service';
import { RecommendDto, SetPreferencesDto } from './dto/ai.dto';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(
    private readonly scamDetector: ScamDetectorService,
    private readonly recommendations: RecommendationService,
  ) {}

  @Post('airdrops/:id/assess')
  @ApiOperation({
    summary: 'Run the Gemini legitimacy/scam assessment for an airdrop',
    description:
      'Judges whether the airdrop is a serious project with a future. Persists the ' +
      'verdict (aiLegitScore, aiOutlook, aiFlags, aiSummary) and flags scams.',
  })
  assess(@Param('id') id: string) {
    return this.scamDetector.assess(id);
  }

  @Post('preferences')
  @ApiOperation({
    summary: 'Set a user’s airdrop preferences',
    description: 'Categories, chains, risk tolerance, and effort appetite used to rank recommendations.',
  })
  setPreferences(@Body() dto: SetPreferencesDto) {
    const { userId, ...prefs } = dto;
    return this.recommendations.setPreferences(userId, prefs);
  }

  @Post('recommendations')
  @ApiOperation({
    summary: 'Recommend airdrops for a user',
    description:
      'Returns airdrops ranked by fit to the user’s preferences (explicit or inferred ' +
      'from history), excluding ones flagged as dead or scam.',
  })
  recommend(@Body() dto: RecommendDto) {
    return this.recommendations.recommend(dto.userId, dto.limit ?? 10);
  }
}
