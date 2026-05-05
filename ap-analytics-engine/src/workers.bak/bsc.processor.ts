import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndexerState } from '../database/entities/indexer-state.entity';
import { NFT } from '../database/entities/nft.entity';
import { ViemService } from '../blockchain/viem.service';

@Processor('ingestion-bsc')
@Injectable()
export class BscProcessor extends WorkerHost {
  private readonly logger = new Logger(BscProcessor.name);
  private readonly BATCH_SIZE = 2000n; // 2000 blocks for BSC

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
      const latestBlock = await this.viem.bscClient.getBlockNumber();

      // 2. Get last processed block from DB
      let state = await this.stateRepo.findOne({ where: { network: 'bsc' } });
      if (!state) {
        state = this.stateRepo.create({ network: 'bsc', last_processed_block: (latestBlock - 100n).toString() });
        await this.stateRepo.save(state);
      }

      const fromBlock = BigInt(state.last_processed_block) + 1n;
      let toBlock = fromBlock + this.BATCH_SIZE;

      if (toBlock > latestBlock) {
        toBlock = latestBlock;
      }

      if (fromBlock > toBlock) {
        return; // Nothing to process
      }

      this.logger.log(`[BSC] Syncing blocks ${fromBlock} to ${toBlock}...`);

      // 3. Fetch logs
      // Ex: fetch Transfer events for Hero contract
      // const logs = await this.viem.bscClient.getLogs({
      //   address: process.env.CONTRACT_HERO_BSC as \`0x\${string}\`,
      //   event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
      //   fromBlock,
      //   toBlock,
      // });

      // Simulate parsing & DB Upsert
      const mockNftsToUpsert = []; 
      
      // if (logs.length > 0) { ... upsert logic ... }

      // 4. Update cursor
      state.last_processed_block = toBlock.toString();
      await this.stateRepo.save(state);

      this.logger.log(`[BSC] Processed blocks ${fromBlock}-${toBlock}.`);
      return { fromBlock: fromBlock.toString(), toBlock: toBlock.toString() };
    } catch (error) {
      this.logger.error(`[BSC] Erro no processamento: ${error.message}`);
      throw error; // Let BullMQ retry
    }
  }
}
