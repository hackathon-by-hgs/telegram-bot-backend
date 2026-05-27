import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // Spec §3 — Gamification endpoint also surfaces user profile basics.
  @Get('user/:id')
  async get(@Param('id') id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException();
    return user;
  }

  // Wallet connection bootstrap (spec §2.9). Full Web3 signature verification belongs to /wallet/connect.
  @Post('user/:id/wallet')
  attachWallet(@Param('id') id: string, @Body('address') address: string) {
    return this.users.attachWallet(id, address);
  }
}
