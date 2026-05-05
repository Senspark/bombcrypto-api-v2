const { Client } = require('pg');

async function seed() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'secret',
    database: process.env.DB_NAME || 'bombstats',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    console.log('Clearing old data...');
    await client.query('TRUNCATE TABLE claims, stakes, nfts CASCADE');

    const rarities = ['Common', 'Rare', 'Super Rare', 'Epic', 'Legend', 'Super Legend'];
    const wallets = [
      '0xea3516feb8f3e387eec3004330fd30aff615496a',
      '0x1234567890123456789012345678901234567890',
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      '0xbeefcacebeefcacebeefcacebeefcacebeefcace'
    ];

    console.log('Inserting diverse NFTs...');
    for (let i = 0; i < 150; i++) {
      const wallet = wallets[i % wallets.length];
      const network = i % 2 === 0 ? 'bsc' : 'polygon';
      const tokenId = 2000 + i;
      const rarity = rarities[i % rarities.length];
      
      await client.query(
        'INSERT INTO nfts (id, network, token_id, owner_address, metadata, last_update_block) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
        [network, tokenId, wallet, JSON.stringify({ 
          name: `Hero #${tokenId}`, 
          image: '', 
          attributes: [{ trait_type: 'Rarity', value: rarity }] 
        }), 1200000 + i]
      );
    }

    console.log('Inserting Stake data...');
    for (const wallet of wallets) {
      // BCOIN Stake
      await client.query(
        'INSERT INTO stakes (id, wallet, token, network, amount, last_update_block) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
        [wallet, 'bcoin', 'all', (Math.random() * 50000 + 1000).toFixed(2), 2500000]
      );
      // SENS Stake
      await client.query(
        'INSERT INTO stakes (id, wallet, token, network, amount, last_update_block) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
        [wallet, 'sens', 'all', (Math.random() * 20000 + 500).toFixed(2), 2500000]
      );
    }

    console.log('Inserting Claim data...');
    for (const wallet of wallets) {
      await client.query(
        'INSERT INTO claims (id, wallet, token, network, amount, last_update_block) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
        [wallet, 'bcoin', 'all', (Math.random() * 5000 + 100).toFixed(2), 3500000]
      );
    }

    console.log('Database seeded with perfection for Senspark standards!');
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await client.end();
  }
}

seed();
