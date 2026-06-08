import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService, JsonSchema } from './gemini.service';

export interface UserPreferences {
  categories?: string[];
  chains?: string[];
  riskTolerance?: 'low' | 'medium' | 'high';
  effort?: 'low' | 'medium' | 'high';
}

interface RankedItem {
  airdropId: string;
  fitScore: number; // 0-100 match to preferences
  reason: string;
}

const RANK_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          airdropId: { type: 'string' },
          fitScore: { type: 'integer', minimum: 0, maximum: 100 },
          reason: { type: 'string' },
        },
        required: ['airdropId', 'fitScore', 'reason'],
      },
    },
  },
  required: ['recommendations'],
};

const SYSTEM = `You are an airdrop recommendation engine for "SwiftyDrop Guard".
Given a user's preferences and a list of candidate airdrops (each with id, category,
difficulty, reward, and an AI legitimacy outlook), rank the candidates by how well they
fit the user. Reward category/chain matches, respect the user's risk tolerance and effort
appetite, and prefer airdrops with a stronger legitimacy outlook. Never recommend something
you would warn against. Return only candidates worth surfacing, best first, each with a
short user-facing reason. Respond with JSON only.`;

@Injectable()
export class RecommendationService {
  private readonly log = new Logger(RecommendationService.name);

  constructor(
    private readonly gemini: GeminiService,
    private readonly prisma: PrismaService,
  ) {}

  /** Persist a user's explicit preferences. */
  async setPreferences(userId: string, prefs: UserPreferences) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { preferences: prefs as object },
    });
  }

  async recommend(userId: string, limit = 10) {
    const user = await this.prisma.user
      .findUnique({ where: { id: userId } })
      .catch(() => null);
    if (!user) return [];

    const prefs =
      ((user.preferences as UserPreferences | null) ?? null) ??
      (await this.inferPreferences(userId));

    const candidates = await this.candidatePool(userId);
    if (!candidates.length) return [];

    const ranked = await this.gemini.generateJson<{ recommendations: RankedItem[] }>(
      this.buildPrompt(prefs, candidates),
      RANK_SCHEMA,
      { system: SYSTEM, tier: 'smart' },
    );

    // Graceful fallback: if Gemini is unavailable, rank by AI legit score.
    if (!ranked?.recommendations?.length) {
      return candidates
        .slice()
        .sort((a, b) => (b.aiLegitScore ?? 0) - (a.aiLegitScore ?? 0))
        .slice(0, limit)
        .map((a) => ({ airdrop: a, fitScore: a.aiLegitScore ?? 0, reason: 'Top-rated by legitimacy.' }));
    }

    const byId = new Map(candidates.map((a) => [a.id, a]));
    return ranked.recommendations
      .filter((r) => byId.has(r.airdropId))
      .slice(0, limit)
      .map((r) => ({ airdrop: byId.get(r.airdropId)!, fitScore: r.fitScore, reason: r.reason }));
  }

  /** Recent, legitimate airdrops the user hasn't started yet. */
  private async candidatePool(userId: string) {
    const taken = await this.prisma.airdropTask.findMany({
      where: { userId },
      select: { airdropId: true },
      distinct: ['airdropId'],
    });
    const excludeIds = taken.map((t) => t.airdropId);

    return this.prisma.airdrop.findMany({
      where: {
        id: { notIn: excludeIds },
        // Exclude what the scam detector flagged as dead/scam.
        OR: [{ aiOutlook: null }, { aiOutlook: { in: ['promising', 'uncertain'] } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
  }

  /** No explicit prefs → infer interest from the categories the user has engaged with. */
  private async inferPreferences(userId: string): Promise<UserPreferences> {
    const tasks = await this.prisma.airdropTask.findMany({
      where: { userId },
      select: { airdrop: { select: { category: true } } },
      take: 50,
    });
    const categories = [
      ...new Set(
        tasks.map((t) => t.airdrop.category).filter((c): c is string => !!c),
      ),
    ];
    return { categories, riskTolerance: 'medium', effort: 'medium' };
  }

  private buildPrompt(
    prefs: UserPreferences,
    candidates: Array<{
      id: string;
      name: string;
      category: string | null;
      difficulty: string | null;
      rewardEstimate: string | null;
      aiOutlook: string | null;
      aiLegitScore: number | null;
      trustScore: number | null;
    }>,
  ): string {
    return JSON.stringify(
      {
        preferences: prefs,
        candidates: candidates.map((a) => ({
          airdropId: a.id,
          name: a.name,
          category: a.category,
          difficulty: a.difficulty,
          reward: a.rewardEstimate,
          aiOutlook: a.aiOutlook,
          aiLegitScore: a.aiLegitScore,
          trustScore: a.trustScore,
        })),
      },
      null,
      2,
    );
  }
}
