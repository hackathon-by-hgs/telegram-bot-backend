import { Test, TestingModule } from '@nestjs/testing';
import { TelegramBotController } from './telegram-bot.controller';
import { TelegramBotService } from './telegram-bot.service';

describe('TelegramBotController', () => {
  let controller: TelegramBotController;

  beforeEach(async () => {
    // The real service pulls in Telegraf + every feature service; the controller
    // only needs `running` and the static COMMANDS list, so a light stub suffices.
    const serviceStub = { running: false } as Partial<TelegramBotService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramBotController],
      providers: [{ provide: TelegramBotService, useValue: serviceStub }],
    }).compile();

    controller = module.get<TelegramBotController>(TelegramBotController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('reports status with the registered command list', () => {
    const status = controller.status();
    expect(status.running).toBe(false);
    expect(status.commands).toBe(TelegramBotService.COMMANDS);
  });
});
