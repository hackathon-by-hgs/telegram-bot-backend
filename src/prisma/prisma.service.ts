import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    super({ adapter, log: ['warn', 'error'] });
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      // Spec §7: system must degrade gracefully — allow boot without DB so health/docs still respond.
      this.logger.warn(`Prisma could not connect: ${(err as Error).message}. Continuing in degraded mode.`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect().catch(() => undefined);
  }
}
