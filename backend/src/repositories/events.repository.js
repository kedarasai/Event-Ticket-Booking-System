const { pool } = require('../config/database');

/**
 * Escapes characters that have special meaning in MySQL LIKE patterns.
 */
function escapeLike(str) {
  return str.replace(/[\\%_]/g, '\\$&');
}

/**
 * Events Repository
 * Performs parameterized database queries for event catalog data.
 */
class EventsRepository {
  async countAll({ search } = {}) {
    let query = `
      SELECT COUNT(*) AS total
      FROM events e
      WHERE e.event_date > UTC_TIMESTAMP()
    `;
    const params = [];

    if (search && search.trim() !== '') {
      const pattern = `%${escapeLike(search.trim())}%`;
      query += ` AND (e.title LIKE ? OR e.venue LIKE ? OR e.category LIKE ?)`;
      params.push(pattern, pattern, pattern);
    }

    const [rows] = await pool.query(query, params);
    return Number(rows[0]?.total || 0);
  }

  async findAll({ search, page = 1, limit = 12 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 12));
    const offset = (pageNum - 1) * limitNum;

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
        COUNT(s.seat_id) AS total_seats,
        COALESCE(SUM(CASE WHEN s.status = 'AVAILABLE' THEN 1 ELSE 0 END), 0) AS available_seats
      FROM events e
      LEFT JOIN seats s ON e.event_id = s.event_id
      WHERE e.event_date > UTC_TIMESTAMP()
    `;
    const params = [];

    if (search && search.trim() !== '') {
      const pattern = `%${escapeLike(search.trim())}%`;
      query += ` AND (e.title LIKE ? OR e.venue LIKE ? OR e.category LIKE ?)`;
      params.push(pattern, pattern, pattern);
    }

    query += `
      GROUP BY e.event_id
      ORDER BY e.event_date ASC
      LIMIT ? OFFSET ?
    `;
    params.push(limitNum, offset);

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
        COALESCE(SUM(CASE WHEN s.status = 'AVAILABLE' THEN 1 ELSE 0 END), 0) AS available_seats
      FROM events e
      LEFT JOIN seats s ON e.event_id = s.event_id
      WHERE e.event_id = ? AND e.event_date > UTC_TIMESTAMP()
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
