import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';
import { ContractAnalyzer } from './analyzers/contract.analyzer';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [HttpModule.register({ timeout: 8000 }), WalletModule],
  providers: [SecurityService, ContractAnalyzer],
  controllers: [SecurityController],
  exports: [SecurityService],
})
export class SecurityModule {}
