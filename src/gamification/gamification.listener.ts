import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GamificationService } from './gamification.service';
import { EVENTS } from '../events/event-names';

@Injectable()
export class GamificationListener {
  constructor(private readonly gamification: GamificationService) {}

  @OnEvent(EVENTS.TASK_COMPLETED)
  onTaskCompleted(payload: { userId: string }) {
    return this.gamification.rewardTaskCompletion(payload.userId);
  }

  @OnEvent(EVENTS.REFERRAL_COMPLETED)
  onReferralCompleted(payload: { referrerId: string }) {
    return this.gamification.rewardReferral(payload.referrerId);
  }
}
