import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [HttpModule.register({ timeout: 10000 }), UsersModule],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
