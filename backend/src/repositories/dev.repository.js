const { pool } = require('../config/database');

/**
 * Dev Repository
 * Dedicated queries for dev-only race conditions and concurrency testing.
 * SQL only in repositories, parameterized queries ONLY.
 */
class DevRepository {
  /**
   * Find or create a race test user with bcrypt password hash.
   */
  async ensureRaceUser(email, name, passwordHash) {
    const [rows] = await pool.query(
      'SELECT user_id, name, email FROM users WHERE email = ?',
      [email]
    );

    if (rows.length > 0) {
      return {
        userId: rows[0].user_id,
        name: rows[0].name,
        email: rows[0].email
      };
    }

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, 'USER']
    );

    return {
      userId: result.insertId,
      name,
      email
    };
  }

  /**
   * Find active confirmed booking for an event and seat.
   */
  async findActiveBookingForSeat(eventId, seatId) {
    const [rows] = await pool.query(
      `SELECT b.booking_id, b.user_id, b.status 
       FROM bookings b
       JOIN booking_seats bs ON b.booking_id = bs.booking_id
       WHERE b.event_id = ? AND bs.seat_id = ? AND bs.is_active = TRUE AND b.status = 'CONFIRMED'
       LIMIT 1`,
      [eventId, seatId]
    );

    if (!rows.length) return null;

    return {
      bookingId: rows[0].booking_id,
      userId: rows[0].user_id,
      status: rows[0].status
    };
  }

  /**
   * Count active booking_seats records for a seat (SQL check for zero-double-booking guarantee).
   */
  async countActiveBookingSeats(seatId) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS activeCount
       FROM booking_seats bs
       JOIN bookings b ON bs.booking_id = b.booking_id
       WHERE bs.seat_id = ? AND bs.is_active = TRUE AND b.status = 'CONFIRMED'`,
      [seatId]
    );

    return Number(rows[0]?.activeCount || 0);
  }
}

module.exports = new DevRepository();
