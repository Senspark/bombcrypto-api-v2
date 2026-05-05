import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('indexer_state')
export class IndexerState {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  network: string; // 'bsc' or 'polygon'

  @Column({ type: 'bigint', default: 0 })
  last_processed_block: string;

  @UpdateDateColumn()
  updated_at: Date;
}
