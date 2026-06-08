import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SwiftyExService } from './swiftyex.service';
import { SwiftyExController } from './swiftyex.controller';
import { SwiftyExAuth } from './swiftyex.auth';

@Module({
  imports: [HttpModule.register({ timeout: 10000 })],
  providers: [SwiftyExService, SwiftyExAuth],
  controllers: [SwiftyExController],
  exports: [SwiftyExService],
})
export class SwiftyExModule {}
