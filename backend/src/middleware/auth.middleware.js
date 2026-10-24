const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

/**
 * Authentication Middleware
 * Validates Bearer JWT from Authorization header and sets req.user = { userId, role }.
 * Returns 401 for missing, malformed, invalid, or expired tokens.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required. Missing or malformed token.', 401));
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.trim() === '') {
    return next(new AppError('Authentication required. Missing token.', 401));
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId || !decoded.role) {
      return next(new AppError('Invalid authentication token payload.', 401));
    }

    // Attach verified identity strictly from JWT
    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };
    return next();
  } catch (err) {
    return next(new AppError('Invalid or expired authentication token.', 401));
  }
}

/**
 * Role Authorization Middleware
 * Enforces role-based permissions (e.g. requireRole('ADMIN')).
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Access forbidden. Insufficient permissions.', 403));
    }

    return next();
  };
}

module.exports = {
  authenticate,
  requireRole
};
