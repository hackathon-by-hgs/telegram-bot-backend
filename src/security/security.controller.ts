import { Body, Controller, Post } from '@nestjs/common';
import { SecurityService } from './security.service';
import { WalletService } from '../wallet/wallet.service';
import { AnalysisInput } from './types';

@Controller('security')
export class SecurityController {
  constructor(
    private readonly security: SecurityService,
    private readonly wallet: WalletService,
  ) {}

  // POST /security/analyze-airdrop
  @Post('analyze-airdrop')
  analyzeAirdrop(@Body() body: AnalysisInput & { airdropId?: string }) {
    return this.security.analyzeAirdrop(body);
  }

  // POST /security/analyze-wallet
  @Post('analyze-wallet')
  analyzeWallet(@Body('address') address: string, @Body('chain') chain?: string) {
    return this.wallet.analyze(address, chain ?? 'eth');
  }
}
