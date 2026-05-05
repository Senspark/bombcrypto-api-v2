import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NFT } from '../database/entities/nft.entity';
import { Stake } from '../database/entities/stake.entity';
import { Claim } from '../database/entities/claim.entity';
import { NftController } from './nft.controller';
import { ThController } from './th.controller';
import { NftService } from './nft.service';

@Module({
  imports: [TypeOrmModule.forFeature([NFT, Stake, Claim])],
  controllers: [NftController, ThController],
  providers: [NftService],
})
export class ApiModule {}
