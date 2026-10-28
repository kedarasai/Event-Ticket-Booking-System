const { closeTestDb } = require('./dbHelper');
const { pool } = require('../src/config/database');

module.exports = async function globalTeardown() {
  try {
    await pool.end();
  } catch (_) {}
  await closeTestDb();
};
