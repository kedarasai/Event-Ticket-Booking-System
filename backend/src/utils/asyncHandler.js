/**
 * Wraps an asynchronous Express route handler or middleware.
 * Ensures any rejected Promise or thrown error is passed to next().
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
