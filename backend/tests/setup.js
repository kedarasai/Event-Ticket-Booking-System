const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.test') });
process.env.NODE_ENV = 'test';

const { seedTestDatabase, closeTestDb } = require('./dbHelper');
const { pool } = require('../src/config/database');

beforeAll(async () => {
  // Reset state to pristine seed before running any file's tests
  await seedTestDatabase();
});

afterAll(async () => {
  // Drain database pools cleanly
  await pool.end();
  await closeTestDb();
});
