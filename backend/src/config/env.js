const path = require('path');
const dotenv = require('dotenv');

// Determine which .env file to load if not already loaded
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(__dirname, '..', '..', envFile) });

const requiredEnvVars = [
  'PORT',
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'CORS_ORIGIN',
  'NODE_ENV'
];

const missing = [];
const invalid = [];

for (const key of requiredEnvVars) {
  const val = process.env[key];
  if (val === undefined || val === null || val.trim() === '') {
    missing.push(key);
  }
}

const port = Number(process.env.PORT);
if (isNaN(port) || port < 1 || port > 65535) {
  invalid.push(`PORT must be a valid port number between 1 and 65535 (received: "${process.env.PORT}")`);
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  invalid.push('JWT_SECRET must be at least 32 characters long');
}

if (missing.length > 0 || invalid.length > 0) {
  const errorMessages = [];
  if (missing.length > 0) {
    errorMessages.push(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (invalid.length > 0) {
    errorMessages.push(`Invalid environment variable values:\n  - ${invalid.join('\n  - ')}`);
  }
  const fullError = `\n=======================================================\n` +
    `CRITICAL ENVIRONMENT CONFIGURATION ERROR:\n` +
    errorMessages.join('\n') +
    `\n=======================================================\n`;
  throw new Error(fullError);
}

const env = {
  port,
  nodeEnv: process.env.NODE_ENV,
  jwtSecret: process.env.JWT_SECRET,
  corsOrigin: process.env.CORS_ORIGIN,
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME
  },
  rateLimits: {
    globalMax: Number(process.env.RATE_LIMIT_GLOBAL_MAX || 300),
    authMax: Number(process.env.RATE_LIMIT_AUTH_MAX || 100),
    bookingsMax: Number(process.env.RATE_LIMIT_BOOKINGS_MAX || 120)
  }
};

module.exports = env;
