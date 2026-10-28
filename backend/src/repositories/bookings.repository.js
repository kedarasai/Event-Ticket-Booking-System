const { pool } = require('../config/database');

/**
 * Bookings Repository
 * Manages queries and updates for bookings and booking_seats.
 */
class BookingsRepository {
  async findExistingBookingByIdempotency(userId, idempotencyKey) {
    if (!idempotencyKey) return null;

    const [rows] = await pool.query(
      `SELECT 
        b.booking_id,
        b.booking_reference,
        b.status,
        b.event_id,
        b.total_amount
      FROM bookings b
      WHERE b.user_id = ? AND b.idempotency_key = ?`,
      [userId, idempotencyKey]
    );

    if (!rows.length) return null;
    const r = rows[0];

    const [seatRows] = await pool.query(
      `SELECT s.seat_id, s.seat_number, s.section, s.tier, bs.price_paid AS price
       FROM booking_seats bs
       JOIN seats s ON bs.seat_id = s.seat_id
       WHERE bs.booking_id = ?
       ORDER BY s.seat_id ASC`,
      [r.booking_id]
    );

    const seats = seatRows
      .map((s) => ({
        seatId: s.seat_id,
        seatNumber: s.seat_number,
        section: s.section,
        tier: s.tier,
        price: Number(s.price)
      }))
      .sort((a, b) => a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true }));

    const seatNumbers = seats.map((s) => s.seatNumber);
    const seatIds = seats.map((s) => s.seatId).sort((a, b) => a - b);

    return {
      bookingId: r.booking_id,
      bookingReference: r.booking_reference,
      status: r.status,
      eventId: r.event_id,
      seatIds,
      seatNumbers,
      seats,
      totalAmount: Number(r.total_amount)
    };
  }

  async findByUserId(userId) {
    const [rows] = await pool.query(
      `SELECT 
        b.booking_id,
        b.booking_reference,
        b.status,
        b.total_amount,
        b.created_at,
        e.event_id,
        e.title AS event_title,
        e.venue AS event_venue,
        e.event_date,
        e.category AS event_category
      FROM bookings b
      JOIN events e ON b.event_id = e.event_id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC`,
      [userId]
    );

    if (!rows.length) return [];

    const bookingIds = rows.map((b) => b.booking_id);
    const [seatRows] = await pool.query(
      `SELECT bs.booking_id, s.seat_id, s.seat_number, s.section, s.tier, bs.price_paid AS price
       FROM booking_seats bs
       JOIN seats s ON bs.seat_id = s.seat_id
       WHERE bs.booking_id IN (?)
       ORDER BY s.seat_id ASC`,
      [bookingIds]
    );

    const seatsByBookingId = new Map();
    for (const bId of bookingIds) {
      seatsByBookingId.set(bId, []);
    }
    for (const s of seatRows) {
      seatsByBookingId.get(s.booking_id)?.push({
        seatId: s.seat_id,
        seatNumber: s.seat_number,
        section: s.section,
        tier: s.tier,
        price: Number(s.price)
      });
    }

    return rows.map((r) => {
      const seats = (seatsByBookingId.get(r.booking_id) || []).sort((a, b) =>
        a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true })
      );
      const seatNumbers = seats.map((s) => s.seatNumber);

      return {
        bookingId: r.booking_id,
        bookingReference: r.booking_reference,
        status: r.status,
        totalAmount: Number(r.total_amount),
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        event: {
          eventId: r.event_id,
          title: r.event_title,
          venue: r.event_venue,
          eventDate: r.event_date ? new Date(r.event_date).toISOString() : null,
          category: r.event_category || 'Concert'
        },
        seatNumbers,
        seats
      };
    });
  }

  async findById(bookingId) {
    const [rows] = await pool.query(
      `SELECT 
        b.booking_id,
        b.user_id,
        b.event_id,
        b.booking_reference,
        b.status,
        b.total_amount,
        b.created_at,
        e.title AS event_title,
        e.venue AS event_venue,
        e.event_date
      FROM bookings b
      JOIN events e ON b.event_id = e.event_id
      WHERE b.booking_id = ?`,
      [bookingId]
    );

    if (!rows.length) return null;
    const r = rows[0];

    const [seatRows] = await pool.query(
      `SELECT s.seat_id, s.seat_number, s.section, s.tier, bs.price_paid AS price
       FROM booking_seats bs
       JOIN seats s ON bs.seat_id = s.seat_id
       WHERE bs.booking_id = ?
       ORDER BY s.seat_id ASC`,
      [bookingId]
    );

    const seats = seatRows
      .map((s) => ({
        seatId: s.seat_id,
        seatNumber: s.seat_number,
        section: s.section,
        tier: s.tier,
        price: Number(s.price)
      }))
      .sort((a, b) => a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true }));

    const seatNumbers = seats.map((s) => s.seatNumber);
    const seatIds = seats.map((s) => s.seatId).sort((a, b) => a - b);

    return {
      bookingId: r.booking_id,
      userId: r.user_id,
      eventId: r.event_id,
      bookingReference: r.booking_reference,
      status: r.status,
      totalAmount: Number(r.total_amount),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      event: {
        eventId: r.event_id,
        title: r.event_title,
        venue: r.event_venue,
        eventDate: r.event_date ? new Date(r.event_date).toISOString() : null
      },
      seatNumbers,
      seatIds,
      seats
    };
  }

  /**
   * Cancellation helpers executed within a dedicated transaction
   */
  async findBookingForCancel(connection, bookingId) {
    const [rows] = await connection.query(
      'SELECT booking_id, user_id, status FROM bookings WHERE booking_id = ? FOR UPDATE',
      [bookingId]
    );
    return rows[0] || null;
  }

  async updateBookingCancelled(connection, bookingId) {
    await connection.query(
      'UPDATE bookings SET status = "CANCELLED", cancelled_at = UTC_TIMESTAMP() WHERE booking_id = ?',
      [bookingId]
    );
  }

  async deactivateBookingSeats(connection, bookingId) {
    await connection.query(
      'UPDATE booking_seats SET is_active = FALSE WHERE booking_id = ?',
      [bookingId]
    );
  }

  async getBookingSeatIds(connection, bookingId) {
    const [rows] = await connection.query(
      'SELECT seat_id FROM booking_seats WHERE booking_id = ? ORDER BY seat_id ASC',
      [bookingId]
    );
    return rows.map((r) => r.seat_id);
  }

  async releaseSeats(connection, seatIds) {
    if (!seatIds || seatIds.length === 0) return;
    const placeholders = seatIds.map(() => '?').join(',');
    // Lock seats in ascending order to prevent deadlocks
    await connection.query(
      `SELECT seat_id, status FROM seats WHERE seat_id IN (${placeholders}) ORDER BY seat_id ASC FOR UPDATE`,
      seatIds
    );
    // Mark them AVAILABLE
    await connection.query(
      `UPDATE seats SET status = "AVAILABLE" WHERE seat_id IN (${placeholders})`,
      seatIds
    );
  }
}

module.exports = new BookingsRepository();
