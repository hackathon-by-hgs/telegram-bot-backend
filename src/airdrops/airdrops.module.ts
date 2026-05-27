import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AirdropsService } from './airdrops.service';
import { AirdropsController } from './airdrops.controller';
import { AirdropsCron } from './airdrops.cron';
import { CoinGeckoSource } from './sources/coingecko.source';
import { CryptoRankSource } from './sources/cryptorank.source';

@Module({
  imports: [HttpModule.register({ timeout: 10000 })],
  providers: [AirdropsService, AirdropsCron, CoinGeckoSource, CryptoRankSource],
  controllers: [AirdropsController],
  exports: [AirdropsService],
})


export class AirdropsModule { }
