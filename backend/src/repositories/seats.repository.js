const { pool } = require('../config/database');

/**
 * Seats Repository
 * Executes queries for seat layouts, status, and event pricing.
 */
class SeatsRepository {
  async findByEventId(eventId) {
    // 1 query for event existence and price
    const [eventRows] = await pool.query(
      'SELECT event_id, price FROM events WHERE event_id = ? AND event_date > UTC_TIMESTAMP()',
      [eventId]
    );

    if (!eventRows.length) return null;

    const event = eventRows[0];

    // 1 query for all seats of the event, ordered by row_label ASC, seat_col ASC
    const [seatRows] = await pool.query(
      `SELECT seat_id, seat_number, row_label, seat_col, status
       FROM seats
       WHERE event_id = ?
       ORDER BY row_label ASC, seat_col ASC`,
      [eventId]
    );

    return {
      eventId: event.event_id,
      price: Number(event.price),
      seats: seatRows.map((s) => ({
        seatId: s.seat_id,
        seatNumber: s.seat_number,
        row: s.row_label,
        number: Number(s.seat_col),
        status: s.status
      }))
    };
  }
}

module.exports = new SeatsRepository();
