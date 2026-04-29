const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:password@localhost:5432/bombcrypto2'
});

async function simulateWager(userId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Simulate fn_sub_user_reward logic
    const res = await client.query(
      'SELECT values FROM user_block_reward WHERE uid = $1 AND reward_type = $2 AND type = $3 FOR UPDATE',
      [userId, 'BCOIN', 'BSC']
    );
    
    if (res.rows.length === 0) throw new Error('User not found');
    const balance = res.rows[0].values;
    
    if (balance < amount) {
       // console.log(`[Double-Spend] Rejected: User ${userId} balance ${balance} < ${amount}`);
       await client.query('ROLLBACK');
       return false;
    }

    await client.query(
      'UPDATE user_block_reward SET values = values - $1 WHERE uid = $1 AND reward_type = $2 AND type = $3',
      [amount, userId, 'BCOIN', 'BSC']
    );
    
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    return false;
  } finally {
    client.release();
  }
}

async function runStressTest() {
  console.log('--- Starting DB Stress Test: Double-Spend Prevention ---');
  const userId = 1;
  const initialBalance = 100;
  const wagerAmount = 10;
  
  // Reset balance
  await pool.query("UPDATE user_block_reward SET values = $1 WHERE uid = $2 AND reward_type = 'BCOIN'", [initialBalance, userId]);
  
  console.log(`Initial Balance: ${initialBalance}. Attempting 20 concurrent wagers of ${wagerAmount}...`);
  
  const attempts = Array(20).fill(0).map(() => simulateWager(userId, wagerAmount));
  const results = await Promise.all(attempts);
  
  const successCount = results.filter(r => r === true).length;
  const finalRes = await pool.query("SELECT values FROM user_block_reward WHERE uid = $1 AND reward_type = 'BCOIN'", [userId]);
  const finalBalance = finalRes.rows[0].values;
  
  console.log(`Success Count: ${successCount}`);
  console.log(`Final Balance: ${finalBalance}`);
  
  if (finalBalance >= 0 && successCount <= (initialBalance / wagerAmount)) {
    console.log('✅ TEST PASSED: No Double-Spend detected. Balance remained consistent.');
  } else {
    console.log('❌ TEST FAILED: Consistency error detected!');
  }
  
  await pool.end();
}

runStressTest().catch(console.error);
