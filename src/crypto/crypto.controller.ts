import { Controller, Get, Param, Query } from '@nestjs/common';
import { CryptoService } from './crypto.service';

@Controller('crypto')
export class CryptoController {
  constructor(private readonly crypto: CryptoService) {}

  @Get('price/:coinId')
  price(@Param('coinId') id: string, @Query('vs') vs?: string) {
    return this.crypto.price(id, vs ?? 'usd').then((value) => ({ id, vs: vs ?? 'usd', value }));
  }

  @Get('trending')
  trending() {
    return this.crypto.trending();
  }
}
