const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { pool, getConnection } = require('../src/config/database');

async function testTz() {
  console.log('Testing session timezone from pool.query:');
  const [rows] = await pool.query('SELECT @@session.time_zone AS tz, NOW() AS now, UTC_TIMESTAMP() AS utc');
  console.log('pool.query result:', rows[0]);

  console.log('Testing dedicated connection from getConnection():');
  const conn = await getConnection();
  try {
    const [connRows] = await conn.query('SELECT @@session.time_zone AS tz, NOW() AS now, UTC_TIMESTAMP() AS utc');
    console.log('getConnection() result:', connRows[0]);
  } finally {
    conn.release();
  }
  await pool.end();
}

testTz().catch(err => {
  console.error(err);
  process.exit(1);
});
