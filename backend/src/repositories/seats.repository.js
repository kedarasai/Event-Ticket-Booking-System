const { pool } = require('../config/database');

/**
 * Seats Repository
 * Executes queries for seat layouts, status, and event pricing.
 */
class SeatsRepository {
  async findByEventId(eventId) {
    // 1 query for event existence
    const [eventRows] = await pool.query(
      'SELECT event_id FROM events WHERE event_id = ? AND event_date > UTC_TIMESTAMP()',
      [eventId]
    );

    if (!eventRows.length) return null;

    const event = eventRows[0];

    // 1 query for all seats of the event, ordered by section order (seat_id), row_label ASC, seat_col ASC
    const [seatRows] = await pool.query(
      `SELECT seat_id, section, tier, price, seat_number, row_label, seat_col, status
       FROM seats
       WHERE event_id = ?
       ORDER BY seat_id ASC`,
      [eventId]
    );

    return {
      eventId: event.event_id,
      seats: seatRows.map((s) => ({
        seatId: s.seat_id,
        section: s.section,
        tier: s.tier,
        price: Number(s.price),
        seatNumber: s.seat_number,
        row: s.row_label,
        number: Number(s.seat_col),
        status: s.status
      }))
    };
  }
}

module.exports = new SeatsRepository();
