const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z',
  dateStrings: false
});

/**
 * Acquire a dedicated connection from the pool.
 * Remember to release the connection in a finally block!
 */
async function getConnection() {
  return await pool.getConnection();
}

module.exports = {
  pool,
  getConnection
};
