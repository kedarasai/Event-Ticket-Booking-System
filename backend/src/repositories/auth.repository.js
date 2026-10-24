const { pool } = require('../config/database');

/**
 * Authentication Repository
 * Handles all database interactions for user identities.
 */
class AuthRepository {
  async findByEmail(email) {
    const [rows] = await pool.query(
      'SELECT user_id, name, email, password_hash, role, created_at FROM users WHERE email = ?',
      [email]
    );
    if (!rows.length) return null;
    const user = rows[0];
    return {
      userId: user.user_id,
      name: user.name,
      email: user.email,
      passwordHash: user.password_hash,
      role: user.role,
      createdAt: user.created_at ? new Date(user.created_at).toISOString() : null
    };
  }

  async findById(userId) {
    const [rows] = await pool.query(
      'SELECT user_id, name, email, role, created_at FROM users WHERE user_id = ?',
      [userId]
    );
    if (!rows.length) return null;
    const user = rows[0];
    return {
      userId: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.created_at ? new Date(user.created_at).toISOString() : null
    };
  }

  async createUser({ name, email, passwordHash, role = 'USER' }) {
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, role]
    );
    return {
      userId: result.insertId,
      name,
      email,
      role
    };
  }
}

module.exports = new AuthRepository();
