const { pool } = require('../config/database');

/**
 * Events Repository
 * Performs parameterized database queries for event catalog data.
 */
class EventsRepository {
  async findAll({ search, page = 1, limit = 10 }) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT 
        e.event_id,
        e.title,
        e.description,
        e.venue,
        e.event_date,
        e.price,
        e.category,
        e.image_url,
        e.created_at,
        COUNT(s.seat_id) AS total_seats,
        SUM(CASE WHEN s.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_seats
      FROM events e
      LEFT JOIN seats s ON e.event_id = s.event_id
    `;
    const params = [];

    if (search) {
      query += ` WHERE e.title LIKE ? OR e.venue LIKE ? OR e.category LIKE ? `;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    query += `
      GROUP BY e.event_id
      ORDER BY e.event_date ASC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    return rows.map((row) => ({
      eventId: row.event_id,
      title: row.title,
      description: row.description,
      venue: row.venue,
      eventDate: row.event_date ? new Date(row.event_date).toISOString() : null,
      price: Number(row.price),
      category: row.category,
      imageUrl: row.image_url,
      availableSeats: Number(row.available_seats || 0),
      totalSeats: Number(row.total_seats || 0)
    }));
  }

  async findById(eventId) {
    const [rows] = await pool.query(
      `SELECT 
        e.event_id,
        e.title,
        e.description,
        e.venue,
        e.event_date,
        e.price,
        e.category,
        e.image_url,
        COUNT(s.seat_id) AS total_seats,
        SUM(CASE WHEN s.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_seats
      FROM events e
      LEFT JOIN seats s ON e.event_id = s.event_id
      WHERE e.event_id = ?
      GROUP BY e.event_id`,
      [eventId]
    );

    if (!rows.length) return null;

    const row = rows[0];
    return {
      eventId: row.event_id,
      title: row.title,
      description: row.description,
      venue: row.venue,
      eventDate: row.event_date ? new Date(row.event_date).toISOString() : null,
      price: Number(row.price),
      category: row.category,
      imageUrl: row.image_url,
      availableSeats: Number(row.available_seats || 0),
      totalSeats: Number(row.total_seats || 0)
    };
  }
}

module.exports = new EventsRepository();
