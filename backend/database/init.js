require('dotenv').config();

async function init() {
  console.log('Running database initialization...');
  const pool = require('../src/config/db');
  try {
    const [result] = await pool.query('SELECT DATABASE() AS db, VERSION() AS version');
    console.log(`Database connected: ${result[0].db} (MySQL ${result[0].version})`);
    console.log('Database schema initialization completed.');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Database initialization error:', error.message);
    process.exit(1);
  }
}

init();
