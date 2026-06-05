import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class AttachWalletDto {
  @ApiProperty({
    description:
      'EVM wallet address (0x-prefixed, 42 chars). Will be lowercased before persistence.',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0BEb0',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'address must be a valid 0x-prefixed EVM address',
  })
  address!: string;
}
