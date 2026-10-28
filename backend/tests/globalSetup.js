const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.test') });
process.env.NODE_ENV = 'test';

const { applyTestSchema, seedTestDatabase, closeTestDb } = require('./dbHelper');

module.exports = async function globalSetup() {
  console.log('\n[JEST GLOBAL SETUP] Applying schema and seeding small test dataset...');
  await applyTestSchema();
  await seedTestDatabase();
  await closeTestDb();
  console.log('[JEST GLOBAL SETUP] Schema applied and small seed ready (2 events, 20 seats each, 3 users).\n');
};
