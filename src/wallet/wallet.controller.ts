import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { UsersService } from '../users/users.service';
import {
  SUPPORTED_CHAINS,
  WalletAnalysisDto,
  WalletConnectDto,
} from './dto/wallet.dto';
import { UserDto } from '../common/dto/models.dto';

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly users: UsersService,
  ) {}

  @Post('connect')
  @ApiOperation({
    summary: 'Connect a wallet to a user',
    description:
      'Persists the wallet address against the user. ' +
      'Production deployments should additionally verify a WalletConnect signature challenge before calling this endpoint; ' +
      'the hackathon trusts the Mini App-bridged address.',
  })
  @ApiOkResponse({ type: UserDto })
  connect(@Body() dto: WalletConnectDto) {
    return this.users.attachWallet(dto.userId, dto.address);
  }

  @Get(':address/analysis')
  @ApiOperation({
    summary: 'Analyse a wallet for risk',
    description:
      'Inspects token approvals, contract interactions and flagged-address lists to produce a wallet health score and ' +
      'actionable recommendations. Heavy upstream calls are cached; expect ~1-3s latency on cold lookups.',
  })
  @ApiParam({
    name: 'address',
    description: 'EVM wallet address',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0BEb0',
  })
  @ApiQuery({
    name: 'chain',
    required: false,
    enum: SUPPORTED_CHAINS,
    example: 'eth',
    description: 'Chain identifier; defaults to `eth`.',
  })
  @ApiOkResponse({ type: WalletAnalysisDto })
  analyze(@Param('address') address: string, @Query('chain') chain?: string) {
    return this.wallet.analyze(address, chain ?? 'eth');
  }
}
