import { Controller, Get, Headers, HttpStatus, Logger, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AppService } from './app.service';
import { HealthDto, ReadinessDto } from './common/dto/models.dto';

@ApiTags('health')
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Service banner',
    description: 'Returns the static hello string. Useful as a smoke test that the API is reachable.',
  })
  @ApiOkResponse({ schema: { type: 'string', example: 'Hello World!' } })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Lightweight health check (no DB I/O). Safe to hit from load balancers and container probes.',
  })
  @ApiOkResponse({ type: HealthDto })
  health(@Headers('user-agent') userAgent?: string) {
    // Logged so keep-alive pings are visible in the Render dashboard log stream.
    // The GitHub Actions cron sends a "render-keep-alive" User-Agent, making its
    // hits easy to spot/grep among other traffic.
    this.logger.log(`Liveness ping received (user-agent: ${userAgent ?? 'unknown'})`);
    return { status: 'ok', service: 'swiftydrop-guard-backend', ts: new Date().toISOString() };
  }

  @Get('health/ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Deep check that pings the database (SELECT 1). Returns 200 when all dependencies are up, or 503 when degraded — wire this to load-balancer / k8s readiness probes so traffic only routes once the app can actually serve it.',
  })
  @ApiOkResponse({ type: ReadinessDto, description: 'All dependencies healthy.' })
  @ApiServiceUnavailableResponse({ type: ReadinessDto, description: 'One or more dependencies are down.' })
  async ready(@Res({ passthrough: true }) res: Response) {
    const report = await this.appService.readiness();
    // passthrough: set the status code but let Nest serialize the JSON body.
    res.status(report.ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }
}
