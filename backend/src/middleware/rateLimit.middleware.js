const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const isTest = env.nodeEnv === 'test';

const passThrough = (req, res, next) => next();

/**
 * Global rate limiter: generous general traffic ceiling (default: 300 requests / 15 minutes)
 */
const globalLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: env.rateLimits.globalMax,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          message: 'Too many requests from this IP, please try again after 15 minutes.'
        });
      }
    });

/**
 * Authentication rate limiter: prevents brute force attacks (default: 100 attempts / 15 minutes)
 */
const authLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: env.rateLimits.authMax,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          message: 'Too many authentication attempts, please try again after 15 minutes.'
        });
      }
    });

/**
 * Booking rate limiter: throttles reservation spikes (default: 120 requests / minute)
 */
const bookingLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: 60 * 1000,
      max: env.rateLimits.bookingsMax,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          message: 'Too many booking attempts, please try again after 1 minute.'
        });
      }
    });

module.exports = {
  globalLimiter,
  authLimiter,
  bookingLimiter
};
