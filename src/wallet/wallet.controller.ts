import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { UsersService } from '../users/users.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService, private readonly users: UsersService) {}

  // POST /wallet/connect — body: { userId, address }
  // Real WalletConnect signature verification belongs here in production; for the
  // hackathon we trust the Mini App-bridged address and persist it.
  @Post('connect')
  connect(@Body('userId') userId: string, @Body('address') address: string) {
    return this.users.attachWallet(userId, address);
  }

  // GET /wallet/:address/analysis
  @Get(':address/analysis')
  analyze(@Param('address') address: string, @Query('chain') chain?: string) {
    return this.wallet.analyze(address, chain ?? 'eth');
  }
}
