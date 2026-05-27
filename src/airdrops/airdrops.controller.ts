import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AirdropsService } from './airdrops.service';
import { ListAirdropsQueryDto } from './dto/airdrops.dto';
import { AirdropDto } from '../common/dto/models.dto';

@ApiTags('airdrops')
@Controller('airdrops')
export class AirdropsController {
  constructor(private readonly airdrops: AirdropsService) {}

  @Get()
  @ApiOperation({
    summary: 'List airdrops',
    description: 'Returns airdrops aggregated from all upstream sources, newest first. Capped at 100 per page.',
  })
  @ApiQuery({ name: 'take', required: false, type: Number, example: 50, description: 'Page size (max 100).' })
  @ApiQuery({ name: 'skip', required: false, type: Number, example: 0, description: 'Offset for pagination.' })
  @ApiOkResponse({ type: [AirdropDto] })
  list(@Query() query: ListAirdropsQueryDto) {
    return this.airdrops.list({
      take: Math.min(query.take ?? 50, 100),
      skip: query.skip ?? 0,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Fetch an airdrop by ID',
    description: 'Returns a single airdrop including its most recent SecurityReport (if any).',
  })
  @ApiParam({ name: 'id', description: 'Airdrop ID (CUID)', example: 'ckxk7g2v90100abcd1234efgh' })
  @ApiOkResponse({ type: AirdropDto })
  @ApiNotFoundResponse({ description: 'No airdrop with the given ID.' })
  get(@Param('id') id: string) {
    return this.airdrops.get(id);
  }
}
