import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisInput, SecurityReportOutput, Signal } from './types';
import { analyzeDomain } from './analyzers/domain.analyzer';
import { ContractAnalyzer } from './analyzers/contract.analyzer';
import {
  analyzeLiquidity,
  analyzeOwnership,
  analyzeSocial,
} from './analyzers/heuristic.analyzer';
import { aggregate } from './scoring';
import { EVENTS } from '../events/event-names';

@Injectable()
export class SecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly contract: ContractAnalyzer,
  ) {}

  async analyzeAirdrop(
    input: AnalysisInput & { airdropId?: string },
  ): Promise<SecurityReportOutput> {
    const signals: Signal[] = [
      ...analyzeDomain(input.domain),
      ...(await this.contract.analyze(input.contractAddress, input.chain)),
      ...analyzeLiquidity(input.tokenInfo),
      ...analyzeOwnership(input.tokenInfo),
      ...analyzeSocial(input.socialLinks),
    ];

    const report = aggregate(signals);

    // Persist for caching (spec §2.3 — security_reports table).
    if (input.airdropId) {
      await this.prisma.securityReport
        .create({
          data: {
            airdropId: input.airdropId,
            subject: input.domain ?? input.contractAddress ?? input.airdropId,
            trustScore: report.trust_score,
            scamProbability: report.scam_probability,
            riskLevel: report.risk_level,
            warnings: report.warnings,
            explanation: report.explanation,
          },
        })
        .catch(() => undefined); // never block response on persistence

      // Keep airdrop.trustScore denormalized so /airdrops can sort/filter cheaply.
      await this.prisma.airdrop
        .update({
          where: { id: input.airdropId },
          data: { trustScore: report.trust_score },
        })
        .catch(() => undefined);

      if (report.risk_level === 'high') {
        this.events.emit(EVENTS.AIRDROP_FLAGGED, {
          airdropId: input.airdropId,
          scamProbability: report.scam_probability,
        });
      }
    }

    return report;
  }
}
