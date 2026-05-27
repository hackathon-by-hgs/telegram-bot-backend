import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { HealthDto } from './common/dto/models.dto';

@ApiTags('health')
@Controller()
export class AppController {
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
  health() {
    return { status: 'ok', service: 'swiftydrop-guard-backend', ts: new Date().toISOString() };
  }
}
