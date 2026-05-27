import { Controller, Get, Param, Query } from '@nestjs/common';
import { AirdropsService } from './airdrops.service';

@Controller('airdrops')
export class AirdropsController {
  constructor(private readonly airdrops: AirdropsService) {}

  // GET /airdrops?take=50&skip=0
  @Get()
  list(@Query('take') take?: string, @Query('skip') skip?: string) {
    return this.airdrops.list({
      take: take ? Math.min(parseInt(take, 10), 100) : 50,
      skip: skip ? parseInt(skip, 10) : 0,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.airdrops.get(id);
  }
}
