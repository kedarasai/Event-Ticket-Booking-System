const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const env = require('./config/env');
const { pool } = require('./config/database');
const { globalLimiter } = require('./middleware/rateLimit.middleware');
const errorMiddleware = require('./middleware/error.middleware');

const authRoutes = require('./routes/auth.routes');
const eventsRoutes = require('./routes/events.routes');
const seatsRoutes = require('./routes/seats.routes');
const bookingsRoutes = require('./routes/bookings.routes');

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
    credentials: true
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(globalLimiter);

// Health check endpoint (pings database)
app.get('/api/v1/health', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT 1 + 1 AS solution, DATABASE() AS databaseName, VERSION() AS version'
    );
    return res.status(200).json({
      success: true,
      message: 'Server and database are healthy',
      data: {
        status: 'UP',
        database: rows[0].databaseName,
        mysqlVersion: rows[0].version,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Health check database ping failed:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Database health check failed'
    });
  }
});

// Mount modular API v1 routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/events', eventsRoutes);
app.use('/api/v1/seats', seatsRoutes);
app.use('/api/v1/bookings', bookingsRoutes);

// 404 Catch-all handler for unmapped routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handler mounted LAST
app.use(errorMiddleware);

module.exports = app;
