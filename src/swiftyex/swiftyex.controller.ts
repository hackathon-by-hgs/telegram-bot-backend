import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SwiftyExService } from './swiftyex.service';
import {
  SwiftyExAuthDto,
  SwiftyExMeDto,
  SwiftyExRateDto,
  SwiftyExTransactionsDto,
  SwiftyExWalletDto,
  SwiftyExWebhookDto,
} from './dto/swiftyex.dto';

@ApiTags('swiftyex')
@Controller('swiftyex')
export class SwiftyExController {
  constructor(private readonly swiftyEx: SwiftyExService) {}

  @Post('me')
  @ApiOperation({
    summary: 'SwiftyEx user profile',
    description:
      'Proxies POST /miniapp/me. Forwards the caller’s Telegram initData.',
  })
  @ApiOkResponse({ type: SwiftyExMeDto })
  me(@Body() dto: SwiftyExAuthDto) {
    return this.swiftyEx.me(dto.initData ?? '');
  }

  @Post('wallets')
  @ApiOperation({
    summary: 'SwiftyEx wallets, balances & deposit addresses',
    description: 'Proxies POST /miniapp/wallets.',
  })
  @ApiOkResponse({ type: [SwiftyExWalletDto] })
  wallets(@Body() dto: SwiftyExAuthDto) {
    return this.swiftyEx.wallets(dto.initData ?? '');
  }

  @Post('transactions')
  @ApiOperation({
    summary: 'SwiftyEx paginated transaction history',
    description: 'Proxies POST /miniapp/transactions (20 per page).',
  })
  transactions(@Body() dto: SwiftyExTransactionsDto) {
    return this.swiftyEx.transactions(
      dto.initData ?? '',
      dto.page ?? 1,
      dto.wallet_type,
    );
  }

  @Get('rates')
  @ApiOperation({
    summary: 'Current SwiftyEx buy/sell rates',
    description:
      'Public — no initData. Served from cache, refreshed by the rates cron.',
  })
  @ApiOkResponse({ type: [SwiftyExRateDto] })
  rates() {
    return this.swiftyEx.rates();
  }

  @Post('sync')
  @ApiOperation({
    summary: 'Sync SwiftyEx account into SwiftyDrop Guard',
    description:
      'Pulls profile + wallets, persists a snapshot, and emits link/KYC/deposit events ' +
      'that drive gamification and notifications.',
  })
  sync(@Body() dto: SwiftyExAuthDto) {
    return this.swiftyEx.sync(dto.initData ?? '');
  }

  @Post('webhook')
  @ApiOperation({
    summary: 'SwiftyEx event webhook (deposit / KYC)',
    description:
      'Real-time push from SwiftyEx. Authenticated by the x-swiftyex-secret header ' +
      '(must equal SWIFTYEX_WEBHOOK_SECRET). Emits deposit/KYC events that drive ' +
      'gamification rewards and Telegram notifications.',
  })
  @ApiHeader({ name: 'x-swiftyex-secret', required: true, description: 'Shared webhook secret.' })
  webhook(
    @Body() dto: SwiftyExWebhookDto,
    @Headers('x-swiftyex-secret') secret?: string,
  ) {
    return this.swiftyEx.handleWebhook(dto, secret);
  }
}
