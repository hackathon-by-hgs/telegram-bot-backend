import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { TelegramModule } from './telegram/telegram.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AirdropsModule } from './airdrops/airdrops.module';
import { SecurityModule } from './security/security.module';
import { WalletModule } from './wallet/wallet.module';
import { CryptoModule } from './crypto/crypto.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TasksModule } from './tasks/tasks.module';
import { GamificationModule } from './gamification/gamification.module';
import { ReferralsModule } from './referrals/referrals.module';
import { AlertsModule } from './alerts/alerts.module';
import { TelegramBotModule } from './telegram-bot/telegram-bot.module';

@Module({
  imports: [
    // Cross-cutting infra (must be first — others depend on env/scheduler/events).
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({ wildcard: true }),

    // Globals
    PrismaModule,
    TelegramModule,

    // Feature modules — order matches spec §6 build phases for readability.
    AuthModule,
    UsersModule,
    AirdropsModule,
    SecurityModule,
    WalletModule,
    CryptoModule,
    TasksModule,
    GamificationModule,
    NotificationsModule,
    ReferralsModule,
    AlertsModule,
    TelegramBotModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
