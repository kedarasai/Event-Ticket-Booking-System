const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

/**
 * Authentication Controller
 * Handles request orchestration and returns responses adhering to docs/API_CONTRACT.md.
 */
class AuthController {
  register = asyncHandler(async (req, res) => {
    const data = await authService.register(req.body);
    return sendSuccess(res, 201, 'Registration successful', data);
  });

  login = asyncHandler(async (req, res) => {
    const data = await authService.login(req.body);
    return sendSuccess(res, 200, 'Login successful', data);
  });

  getMe = asyncHandler(async (req, res) => {
    const data = await authService.getMe(req.user.userId);
    return sendSuccess(res, 200, 'User profile retrieved', data);
  });
}

module.exports = new AuthController();
