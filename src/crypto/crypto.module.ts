import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CryptoService } from './crypto.service';
import { CryptoController } from './crypto.controller';

@Module({
  imports: [HttpModule.register({ timeout: 8000 })],
  providers: [CryptoService],
  controllers: [CryptoController],
  exports: [CryptoService],
})
export class CryptoModule {}
