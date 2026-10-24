const env = require('./config/env');
const { pool } = require('./config/database');
const app = require('./app');

let server;

async function startServer() {
  try {
    // Verify database connectivity before accepting incoming traffic
    console.log(`Connecting to database ${env.db.name} on ${env.db.host}:${env.db.port}...`);
    const [rows] = await pool.query('SELECT 1 + 1 AS connected, DATABASE() AS db');
    console.log(`Database connected successfully to [${rows[0].db}].`);

    server = app.listen(env.port, () => {
      console.log(`🚀 Express server running on port ${env.port} [NODE_ENV=${env.nodeEnv}]`);
      console.log(`📡 Health check: http://localhost:${env.port}/api/v1/health`);
    });
  } catch (err) {
    console.error('\n=======================================================');
    console.error('FATAL: Database connectivity check failed during startup:');
    console.error(`Message: ${err.message}`);
    console.error('Server startup aborted.');
    console.error('=======================================================\n');
    process.exit(1);
  }
}

// Graceful shutdown handling
function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

    if (server) {
      server.close(() => {
        console.log('HTTP server closed.');
      });
    }

    try {
      await pool.end();
      console.log('Database connection pool drained and closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error draining database connection pool:', err.message);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

setupGracefulShutdown();

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  app
};
