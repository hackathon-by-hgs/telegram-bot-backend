import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SecurityService } from './security.service';
import { WalletService } from '../wallet/wallet.service';
import { AnalyzeAirdropDto, SecurityReportOutputDto } from './dto/security.dto';
import { AnalyzeWalletDto } from './dto/security.dto';
import { WalletAnalysisDto } from '../wallet/dto/wallet.dto';

@ApiTags('security')
@Controller('security')
export class SecurityController {
  constructor(
    private readonly security: SecurityService,
    private readonly wallet: WalletService,
  ) {}

  @Post('analyze-airdrop')
  @ApiOperation({
    summary: 'Analyse an airdrop for scam risk',
    description:
      'Combines domain reputation (WHOIS / SSL / phishing lists), contract checks (verified, holder distribution), ' +
      'and social-signal heuristics to produce a `SecurityReportOutput`. ' +
      'If `airdropId` is provided, the report is persisted and the cached `trustScore` on the parent `Airdrop` is updated. ' +
      'A high-risk verdict additionally emits `AIRDROP_FLAGGED` so the notifications module can warn affected users.',
  })
  @ApiOkResponse({ type: SecurityReportOutputDto })
  analyzeAirdrop(@Body() body: AnalyzeAirdropDto) {
    return this.security.analyzeAirdrop(body);
  }

  @Post('analyze-wallet')
  @ApiOperation({
    summary: 'Analyse a wallet for risk',
    description:
      'Convenience wrapper around `GET /wallet/:address/analysis` that accepts a JSON body. Same response shape and caching.',
  })
  @ApiOkResponse({ type: WalletAnalysisDto })
  analyzeWallet(@Body() dto: AnalyzeWalletDto) {
    return this.wallet.analyze(dto.address, dto.chain ?? 'eth');
  }
}
