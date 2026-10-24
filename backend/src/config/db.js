const { pool, getConnection } = require('./database');

module.exports = pool;
module.exports.pool = pool;
module.exports.getConnection = getConnection;
