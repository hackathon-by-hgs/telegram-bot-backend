import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ScamDetectorService } from './scam-detector.service';
import { EVENTS } from '../events/event-names';

/**
 * Auto-runs the Gemini legitimacy assessment whenever the airdrop sync creates a
 * new airdrop — same event-driven pattern as gamification/notifications.
 */
@Injectable()
export class AiListener {
  constructor(private readonly scamDetector: ScamDetectorService) {}

  @OnEvent(EVENTS.AIRDROP_CREATED)
  onAirdropCreated(payload: { airdropId: string }) {
    return this.scamDetector.assess(payload.airdropId);
  }
}
