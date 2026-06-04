import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TelegramBotService } from './telegram-bot.service';

/**
 * The bot itself talks to users over Telegram long-polling, so it has no CRUD
 * surface. This controller just exposes an operational status probe (handy for
 * dashboards / health checks) listing whether polling is live and which
 * commands are registered.
 */
@ApiTags('telegram-bot')
@Controller('telegram-bot')
export class TelegramBotController {
  constructor(private readonly telegramBotService: TelegramBotService) {}

  @Get('status')
  @ApiOperation({ summary: 'Interactive bot status & registered commands' })
  status() {
    return {
      running: this.telegramBotService.running,
      commands: TelegramBotService.COMMANDS,
    };
  }
}
