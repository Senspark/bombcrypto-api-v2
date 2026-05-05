import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NFT } from './database/entities/nft.entity';
import { Stake } from './database/entities/stake.entity';
import { Claim } from './database/entities/claim.entity';
import { Repository } from 'typeorm';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const nftRepo = app.get<Repository<NFT>>(getRepositoryToken(NFT));
  const stakeRepo = app.get<Repository<Stake>>(getRepositoryToken(Stake));
  const claimRepo = app.get<Repository<Claim>>(getRepositoryToken(Claim));

  console.log('🌱 Seeding database...');

  // Mock Wallets
  const wallets = [
    '0xea3516feb8f3e387eec3004330fd30aff615496a',
    '0x1234567890abcdef1234567890abcdef12345678',
    '0xabcdef1234567890abcdef1234567890abcdef',
    '0x9876543210fedcba9876543210fedcba98765432'
  ];

  // 1. Seed NFTs
  for (const wallet of wallets) {
    const count = wallet === wallets[0] ? 4 : Math.floor(Math.random() * 10) + 1;
    for (let i = 0; i < count; i++) {
      await nftRepo.save({
        token_id: `id-${wallet}-${i}`,
        owner: wallet,
        network: i % 2 === 0 ? 'bsc' : 'polygon',
        rarity: ['Common', 'Rare', 'Super Rare', 'Epic', 'Legendary'][Math.floor(Math.random() * 5)],
        type: 'hero',
        metadata: { name: `Hero #${i}` },
        last_update_block: 1000000
      });
    }
  }

  // 2. Seed Stakes
  for (const wallet of wallets) {
    await stakeRepo.save({
      wallet,
      token: 'bcoin',
      network: 'bsc',
      amount: Math.random() * 5000 + 1000,
      last_update_block: 1000000
    });
    await stakeRepo.save({
      wallet,
      token: 'sens',
      network: 'polygon',
      amount: Math.random() * 10000 + 5000,
      last_update_block: 1000000
    });
  }

  // 3. Seed Claims
  for (const wallet of wallets) {
    await claimRepo.save({
      wallet,
      token: 'bcoin',
      network: 'bsc',
      amount: Math.random() * 2000 + 500,
      last_update_block: 1000000
    });
  }

  console.log('✅ Seeding complete!');
  await app.close();
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
