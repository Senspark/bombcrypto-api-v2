import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('stakes')
export class Stake {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  wallet: string;

  @Column()
  @Index()
  token: string; // 'bcoin' | 'sens'

  @Column()
  @Index()
  network: string; // 'bsc' | 'polygon'

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  amount: number;

  @Column({ type: 'bigint' })
  last_update_block: number;

  @CreateDateColumn()
  created_at: Date;
}
