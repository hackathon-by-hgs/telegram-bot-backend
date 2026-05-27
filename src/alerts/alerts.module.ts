import { Module } from '@nestjs/common';
import { AlertsCron } from './alerts.cron';
import { NotificationsModule } from '../notifications/notifications.module';
import { GamificationModule } from '../gamification/gamification.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [NotificationsModule, GamificationModule, SecurityModule],
  providers: [AlertsCron],
})
export class AlertsModule {}
