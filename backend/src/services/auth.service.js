const bcrypt = require('bcrypt');
const authRepository = require('../repositories/auth.repository');
const { signToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

/**
 * Authentication Service
 * Implements registration, credential verification, and user profile loading.
 */
class AuthService {
  async register({ name, email, password }) {
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await authRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError('Email is already registered', 409);
    }

    // Hash password with bcrypt (cost = 10)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const createdUser = await authRepository.createUser({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'USER'
    });

    const token = signToken({
      userId: createdUser.userId,
      role: createdUser.role
    });

    return {
      token,
      user: {
        userId: createdUser.userId,
        name: createdUser.name,
        email: createdUser.email,
        role: createdUser.role
      }
    };
  }

  async login({ email, password }) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const genericErrorMsg = 'Invalid email or password';

    // Query user by normalized email
    const user = await authRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new AppError(genericErrorMsg, 401);
    }

    // Verify password hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError(genericErrorMsg, 401);
    }

    const token = signToken({
      userId: user.userId,
      role: user.role
    });

    return {
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role
      }
    };
  }

  async getMe(userId) {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    return {
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role
      }
    };
  }
}

module.exports = new AuthService();
