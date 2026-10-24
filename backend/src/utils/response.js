/**
 * Standardized API success response builder adhering to docs/API_CONTRACT.md
 * Shape: { success: true, message: string, data?: any }
 */
function sendSuccess(res, statusCode = 200, message = 'Success', data = null) {
  const response = {
    success: true,
    message
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
}

module.exports = {
  sendSuccess
};
