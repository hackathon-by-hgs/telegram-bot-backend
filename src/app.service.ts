import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  /**
   * Readiness: unlike the liveness probe, this actually exercises dependencies.
   * The app boots in degraded mode when Postgres is down (see PrismaService), so
   * a readiness check is what tells a load balancer whether to route traffic.
   */
  async readiness() {
    const database = await this.pingDatabase();
    const ready = database.status === 'up';
    return {
      status: ready ? 'ok' : 'degraded',
      ready,
      service: 'swiftydrop-guard-backend',
      checks: { database },
      ts: new Date().toISOString(),
    };
  }

  /** Cheapest possible round-trip that proves the connection pool is live. */
  private async pingDatabase(): Promise<{ status: 'up' | 'down'; error?: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up' };
    } catch (err) {
      return { status: 'down', error: (err as Error).message };
    }
  }
}
