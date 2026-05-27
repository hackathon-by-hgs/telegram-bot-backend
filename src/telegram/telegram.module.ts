import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TelegramBotService } from './telegram-bot.service';

@Global()
@Module({
  imports: [HttpModule.register({ timeout: 8000 })],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramModule {}
