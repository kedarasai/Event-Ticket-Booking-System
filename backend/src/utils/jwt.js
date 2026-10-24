const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Sign a JWT token with 1 day expiry.
 * Payload includes { userId, role }.
 */
function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '1d' });
}

/**
 * Verify a JWT token.
 * Throws JsonWebTokenError or TokenExpiredError if invalid.
 */
function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = {
  signToken,
  verifyToken
};
