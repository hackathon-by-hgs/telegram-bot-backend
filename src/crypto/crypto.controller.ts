import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CryptoService } from './crypto.service';
import { PriceResponseDto, TrendingCoinDto } from './dto/crypto.dto';

@ApiTags('crypto')
@Controller('crypto')
export class CryptoController {
  constructor(private readonly crypto: CryptoService) {}

  @Get('price/:coinId')
  @ApiOperation({
    summary: 'Fetch a coin price (CoinGecko)',
    description:
      'Returns the spot price for `coinId` in the requested quote currency. Results are cached in-memory for 60s. ' +
      'Returns `value: null` if the upstream call fails; the request never errors.',
  })
  @ApiParam({
    name: 'coinId',
    description: 'CoinGecko coin id',
    example: 'ethereum',
  })
  @ApiQuery({
    name: 'vs',
    required: false,
    example: 'usd',
    description: 'Quote currency (`usd`, `eur`, `btc`, …). Defaults to `usd`.',
  })
  @ApiOkResponse({ type: PriceResponseDto })
  price(@Param('coinId') id: string, @Query('vs') vs?: string) {
    return this.crypto
      .price(id, vs ?? 'usd')
      .then((value) => ({ id, vs: vs ?? 'usd', value }));
  }

  @Get('trending')
  @ApiOperation({
    summary: 'Currently trending coins (CoinGecko)',
    description:
      'Returns the top trending coins. Empty array on upstream failure — never errors.',
  })
  @ApiOkResponse({ type: [TrendingCoinDto] })
  trending() {
    return this.crypto.trending();
  }
}
