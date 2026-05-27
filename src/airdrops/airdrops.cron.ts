import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AirdropsService } from './airdrops.service';

@Injectable()
export class AirdropsCron {
  private readonly log = new Logger(AirdropsCron.name);
  constructor(private readonly airdrops: AirdropsService) {}

  // Spec §4: "Airdrop sync job (cron)" — run every 6 hours.
  @Cron(CronExpression.EVERY_6_HOURS)
  async runSync() {
    const result = await this.airdrops.syncAll();
    this.log.log(`Airdrop sync complete: ${JSON.stringify(result)}`);
  }
}
