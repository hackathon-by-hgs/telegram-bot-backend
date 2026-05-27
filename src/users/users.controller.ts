import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AttachWalletDto } from './dto/users.dto';
import { UserDto, UserWithStatsDto } from '../common/dto/models.dto';

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('user/:id')
  @ApiOperation({
    summary: 'Fetch a user profile',
    description: 'Returns the user record plus the joined `UserStats` (XP, level, streak, badges).',
  })
  @ApiParam({ name: 'id', description: 'User ID (CUID)', example: 'ckxk7g2v90000abcd1234efgh' })
  @ApiOkResponse({ type: UserWithStatsDto })
  @ApiNotFoundResponse({ description: 'No user with the given ID.' })
  async get(@Param('id') id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException();
    return user;
  }

  @Post('user/:id/wallet')
  @ApiOperation({
    summary: 'Attach a wallet to a user (Mini App bridge)',
    description:
      'Persists a wallet address against a user record without performing on-chain signature verification. ' +
      'For production-grade Web3 sign-in, use `POST /wallet/connect` instead.',
  })
  @ApiParam({ name: 'id', description: 'User ID (CUID)', example: 'ckxk7g2v90000abcd1234efgh' })
  @ApiOkResponse({ type: UserDto })
  attachWallet(@Param('id') id: string, @Body() dto: AttachWalletDto) {
    return this.users.attachWallet(id, dto.address);
  }
}
