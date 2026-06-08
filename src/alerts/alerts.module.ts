import { Module } from '@nestjs/common';
import { AlertsCron } from './alerts.cron';
import { NotificationsModule } from '../notifications/notifications.module';
import { GamificationModule } from '../gamification/gamification.module';
import { SecurityModule } from '../security/security.module';
import { SwiftyExModule } from '../swiftyex/swiftyex.module';

@Module({
  imports: [NotificationsModule, GamificationModule, SecurityModule, SwiftyExModule],
  providers: [AlertsCron],
})
export class AlertsModule {}
