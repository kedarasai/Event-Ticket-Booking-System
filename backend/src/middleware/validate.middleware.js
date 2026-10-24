const { validationResult } = require('express-validator');

/**
 * express-validator wrapper middleware
 * Formats errors into the standard contract shape:
 * HTTP 400 { success: false, message: <first error message> }
 *
 * Supports both wrapper syntax:
 *   router.post('/path', validate([body('email').isEmail()]), handler)
 * and middleware array syntax:
 *   router.post('/path', [body('email').isEmail()], validate, handler)
 */
function validate(validations) {
  if (!validations || typeof validations.next === 'function' || typeof validations === 'function') {
    const [req, res, next] = arguments;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return res.status(400).json({
        success: false,
        message: firstError.msg || 'Validation failed'
      });
    }
    return next();
  }

  return async (req, res, next) => {
    if (Array.isArray(validations)) {
      for (const validation of validations) {
        await validation.run(req);
      }
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return res.status(400).json({
        success: false,
        message: firstError.msg || 'Validation failed'
      });
    }

    return next();
  };
}

module.exports = validate;
