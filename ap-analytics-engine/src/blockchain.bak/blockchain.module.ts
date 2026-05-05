import { Module } from '@nestjs/common';
import { ViemService } from './viem.service';

@Module({
  providers: [ViemService],
  exports: [ViemService],
})
export class BlockchainModule {}
