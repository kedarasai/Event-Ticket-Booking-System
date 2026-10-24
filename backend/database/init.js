require('dotenv').config();
const applySchema = require('../scripts/apply-schema');

async function init() {
  console.log('Running database initialization...');
  try {
    await applySchema(process.env.DB_NAME);
    console.log('Database initialization finished.');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization error:', error.message);
    process.exit(1);
  }
}

init();
