import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    // AppService pings the DB for readiness, so stub PrismaService.$queryRaw.
    prisma = { $queryRaw: jest.fn() };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('readiness', () => {
    const mockRes = () => ({ status: jest.fn() }) as any;

    it('reports ready + 200 when the database answers', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
      const res = mockRes();

      const report = await appController.ready(res);

      expect(report.ready).toBe(true);
      expect(report.status).toBe('ok');
      expect(report.checks.database.status).toBe('up');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('reports degraded + 503 when the database is down', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
      const res = mockRes();

      const report = await appController.ready(res);

      expect(report.ready).toBe(false);
      expect(report.status).toBe('degraded');
      expect(report.checks.database).toEqual({
        status: 'down',
        error: 'connection refused',
      });
      expect(res.status).toHaveBeenCalledWith(503);
    });
  });
});
