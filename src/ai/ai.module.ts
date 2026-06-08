import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { ScamDetectorService } from './scam-detector.service';
import { RecommendationService } from './recommendation.service';
import { AiListener } from './ai.listener';
import { AiController } from './ai.controller';

@Module({
  providers: [GeminiService, ScamDetectorService, RecommendationService, AiListener],
  controllers: [AiController],
  exports: [ScamDetectorService, RecommendationService],
})
export class AiModule {}
