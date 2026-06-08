import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EVENTS } from '../events/event-names';
import { GeminiService, JsonSchema } from './gemini.service';

export interface LegitimacyVerdict {
  legitScore: number; // 0-100, higher = more legitimate / promising
  outlook: 'promising' | 'uncertain' | 'likely_dead' | 'scam';
  serious: boolean;
  flags: string[];
  summary: string;
}

const VERDICT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    legitScore: { type: 'integer', minimum: 0, maximum: 100 },
    outlook: {
      type: 'string',
      enum: ['promising', 'uncertain', 'likely_dead', 'scam'],
    },
    serious: { type: 'boolean' },
    flags: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['legitScore', 'outlook', 'serious', 'flags', 'summary'],
};

const SYSTEM = `You are a crypto airdrop due-diligence analyst for "SwiftyDrop Guard".
Given an airdrop's public metadata, judge whether it is a SERIOUS project with a real
future, or a low-effort / cash-grab / dead / scam campaign.

Weigh: clarity and substance of the description, credible reward mechanics, named team or
backers, real product vs vaporware, active and genuine socials (not just a fresh Telegram),
realistic deadline, and category maturity. Be skeptical of anonymous teams, copy-paste
"claim now" language, guaranteed/absurd returns, and projects with no product.

Scoring: legitScore 80-100 = strong/promising, 50-79 = uncertain, 20-49 = likely no future,
0-19 = scam. Set outlook accordingly and serious=true only for genuine long-term projects.
flags = short red-flag phrases (empty if none). summary = one or two sentences for the user.
Respond with JSON only.`;

@Injectable()
export class ScamDetectorService {
  private readonly log = new Logger(ScamDetectorService.name);

  constructor(
    private readonly gemini: GeminiService,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Assess one airdrop by id, persist the verdict, and flag scams. */
  async assess(airdropId: string): Promise<LegitimacyVerdict | null> {
    const airdrop = await this.prisma.airdrop
      .findUnique({ where: { id: airdropId } })
      .catch(() => null);
    if (!airdrop) return null;

    const verdict = await this.gemini.generateJson<LegitimacyVerdict>(
      this.buildPrompt(airdrop),
      VERDICT_SCHEMA,
      { system: SYSTEM, tier: 'fast' },
    );
    if (!verdict) return null;

    await this.prisma.airdrop
      .update({
        where: { id: airdropId },
        data: {
          aiLegitScore: this.clamp(verdict.legitScore),
          aiOutlook: verdict.outlook,
          aiSerious: verdict.serious,
          aiFlags: verdict.flags ?? [],
          aiSummary: verdict.summary,
          aiAssessedAt: new Date(),
        },
      })
      .catch(() => undefined);

    // Reuse the existing scam pipeline: a 'scam' verdict drives the same
    // AIRDROP_FLAGGED notification as the rule-based analyzer.
    if (verdict.outlook === 'scam') {
      this.events.emit(EVENTS.AIRDROP_FLAGGED, {
        airdropId,
        scamProbability: 100 - this.clamp(verdict.legitScore),
      });
    }
    this.log.log(
      `Assessed "${airdrop.name}": ${verdict.outlook} (${verdict.legitScore})`,
    );
    return verdict;
  }

  private buildPrompt(a: {
    name: string;
    description: string | null;
    rewardEstimate: string | null;
    deadline: Date | null;
    category: string | null;
    difficulty: string | null;
    socialLinks: unknown;
    source: string;
  }): string {
    return JSON.stringify(
      {
        name: a.name,
        description: a.description,
        rewardEstimate: a.rewardEstimate,
        deadline: a.deadline,
        category: a.category,
        difficulty: a.difficulty,
        socialLinks: a.socialLinks ?? {},
        listedOn: a.source,
      },
      null,
      2,
    );
  }

  private clamp(n: number) {
    return Math.max(0, Math.min(100, Math.round(n)));
  }
}
