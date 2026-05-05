import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndexerState } from '../database/entities/indexer-state.entity';
import { NFT } from '../database/entities/nft.entity';
import { ViemService } from '../blockchain/viem.service';

@Processor('ingestion-polygon')
@Injectable()
export class PolygonProcessor extends WorkerHost {
  private readonly logger = new Logger(PolygonProcessor.name);
  private readonly BATCH_SIZE = 500n; // 500 blocks max for Polygon
  private readonly ANTI_REORG_BLOCKS = 128n; // Keep safe distance from HEAD

  constructor(
    @InjectRepository(IndexerState)
    private readonly stateRepo: Repository<IndexerState>,
    @InjectRepository(NFT)
    private readonly nftRepo: Repository<NFT>,
    private readonly viem: ViemService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    try {
      // 1. Get current block from blockchain
      const headBlock = await this.viem.polygonClient.getBlockNumber();
      const safeBlock = headBlock - this.ANTI_REORG_BLOCKS;

      // 2. Get last processed block from DB
      let state = await this.stateRepo.findOne({ where: { network: 'polygon' } });
      if (!state) {
        state = this.stateRepo.create({ network: 'polygon', last_processed_block: (safeBlock - 100n).toString() });
        await this.stateRepo.save(state);
      }

      const fromBlock = BigInt(state.last_processed_block) + 1n;
      let toBlock = fromBlock + this.BATCH_SIZE;

      // 3. Apply Anti-Reorg constraint
      if (toBlock > safeBlock) {
        toBlock = safeBlock;
      }

      if (fromBlock > toBlock) {
        return; // Nothing to process or waiting for confirmations
      }

      this.logger.log(`[POLYGON] Syncing blocks ${fromBlock} to ${toBlock}...`);

      // 4. Fetch logs using Viem
      // const logs = await this.viem.polygonClient.getLogs({...});

      // Simulate parsing & DB Upsert
      const mockNftsToUpsert = [];

      // 5. Update cursor
      state.last_processed_block = toBlock.toString();
      await this.stateRepo.save(state);

      this.logger.log(`[POLYGON] Processed blocks ${fromBlock}-${toBlock}.`);
      return { fromBlock: fromBlock.toString(), toBlock: toBlock.toString() };
    } catch (error) {
      this.logger.error(`[POLYGON] Erro no processamento: ${error.message}`);
      throw error; // Let BullMQ retry
    }
  }
}
