import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexerState } from '../database/entities/indexer-state.entity';
import { NFT } from '../database/entities/nft.entity';
import { BscProcessor } from './bsc.processor';
import { PolygonProcessor } from './polygon.processor';
import { IngestionCron } from './ingestion.cron';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IndexerState, NFT]),
    BullModule.registerQueue({
      name: 'ingestion-bsc',
    }),
    BullModule.registerQueue({
      name: 'ingestion-polygon',
    }),
    BlockchainModule,
  ],
  providers: [BscProcessor, PolygonProcessor, IngestionCron],
})
export class WorkersModule {}
