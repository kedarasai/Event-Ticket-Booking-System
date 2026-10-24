const authRepository = require('../repositories/auth.repository');
const AppError = require('../utils/AppError');

/**
 * Authentication Service
 * Implements business logic for user registration, authentication, and session retrieval.
 */
class AuthService {
  async register({ name, email, password }) {
    // Feature implementation will go in Phase 4
    return { name, email };
  }

  async login({ email, password }) {
    // Feature implementation will go in Phase 4
    return { email };
  }

  async getMe(userId) {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }
}

module.exports = new AuthService();
