const { pool } = require('../config/database');

/**
 * Bookings Repository
 * Manages queries and updates for bookings and booking_seats.
 */
class BookingsRepository {
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
        GROUP_CONCAT(s.seat_number ORDER BY s.seat_number ASC SEPARATOR ', ') AS seat_numbers
      FROM bookings b
      JOIN events e ON b.event_id = e.event_id
      JOIN booking_seats bs ON b.booking_id = bs.booking_id
      JOIN seats s ON bs.seat_id = s.seat_id
      WHERE b.user_id = ?
      GROUP BY b.booking_id
      ORDER BY b.created_at DESC`,
      [userId]
    );

    return rows.map((r) => ({
      bookingId: r.booking_id,
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
      seatNumbers: r.seat_numbers ? r.seat_numbers.split(', ') : []
    }));
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
        e.event_date,
        GROUP_CONCAT(s.seat_number ORDER BY s.seat_number ASC SEPARATOR ', ') AS seat_numbers,
        GROUP_CONCAT(s.seat_id ORDER BY s.seat_id ASC SEPARATOR ', ') AS seat_ids
      FROM bookings b
      JOIN events e ON b.event_id = e.event_id
      JOIN booking_seats bs ON b.booking_id = bs.booking_id
      JOIN seats s ON bs.seat_id = s.seat_id
      WHERE b.booking_id = ?
      GROUP BY b.booking_id`,
      [bookingId]
    );

    if (!rows.length) return null;
    const r = rows[0];

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
      seatNumbers: r.seat_numbers ? r.seat_numbers.split(', ') : [],
      seatIds: r.seat_ids ? r.seat_ids.split(', ').map(Number) : []
    };
  }
}

module.exports = new BookingsRepository();
