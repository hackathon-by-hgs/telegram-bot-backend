import { Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramBotController } from './telegram-bot.controller';

import { UsersModule } from '../users/users.module';
import { AirdropsModule } from '../airdrops/airdrops.module';
import { SecurityModule } from '../security/security.module';
import { WalletModule } from '../wallet/wallet.module';
import { CryptoModule } from '../crypto/crypto.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { TasksModule } from '../tasks/tasks.module';

/**
 * Wires the interactive bot to the existing feature services. Each imported
 * module already `exports` the service we inject, so the bot is a pure
 * consumer — it adds a chat front-end without duplicating any domain logic.
 */
@Module({
  imports: [
    UsersModule,
    AirdropsModule,
    SecurityModule,
    WalletModule,
    CryptoModule,
    GamificationModule,
    ReferralsModule,
    TasksModule,
  ],
  controllers: [TelegramBotController],
  providers: [TelegramBotService],
})
export class TelegramBotModule {}
