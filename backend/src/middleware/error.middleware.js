const AppError = require('../utils/AppError');

/**
 * Global Error Handling Middleware
 * - Returns uniform JSON: { success: false, message: string }
 * - Logs real errors server-side with stack traces
 * - NEVER leaks SQL queries, internal paths, or stack traces to clients
 * - Maps body-parser syntax errors (malformed JSON) to HTTP 400
 */
function errorMiddleware(err, req, res, next) {
  // Always log real error details server-side
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  // Handle JSON parse errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Malformed JSON payload in request body'
    });
  }

  // Handle custom application operational errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  // Handle specific MySQL errors safely
  if (err.code) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate entry detected; the requested resource already exists.'
      });
    }

    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
      return res.status(400).json({
        success: false,
        message: 'Referenced related entity does not exist.'
      });
    }

    // Generic database error (do not leak query or credentials)
    return res.status(500).json({
      success: false,
      message: 'A database error occurred while processing your request.'
    });
  }

  // Fallback for unexpected exceptions
  const statusCode = err.statusCode || (typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500);
  const message = statusCode === 500 ? 'Internal server error' : (err.message || 'An unexpected error occurred');

  return res.status(statusCode).json({
    success: false,
    message
  });
}

module.exports = errorMiddleware;
