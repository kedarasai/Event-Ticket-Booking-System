const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

// Ensure test environment variables are loaded
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.test') });
process.env.NODE_ENV = 'test';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'ticket_booking_test',
  multipleStatements: true
};

let helperPool = null;

function getHelperPool() {
  if (!helperPool) {
    helperPool = mysql.createPool({
      ...DB_CONFIG,
      waitForConnections: true,
      connectionLimit: 10,
      timezone: 'Z',
      dateStrings: false
    });
    helperPool.pool.on('connection', (conn) => {
      conn.query("SET time_zone = '+00:00'");
    });
  }
  return helperPool;
}

function getUtcEventDate(daysAhead) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(19, 0, 0, 0);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function applyTestSchema() {
  const schemaSql = fs.readFileSync(
    path.resolve(__dirname, '..', 'database', 'schema.sql'),
    'utf8'
  );

  const connection = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    database: DB_CONFIG.database,
    multipleStatements: true
  });

  try {
    await connection.query(schemaSql);
  } finally {
    await connection.end();
  }
}

async function seedTestDatabase() {
  const pool = getHelperPool();
  const conn = await pool.getConnection();

  try {
    // 1. Truncate all tables
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE booking_seats');
    await conn.query('TRUNCATE TABLE bookings');
    await conn.query('TRUNCATE TABLE seats');
    await conn.query('TRUNCATE TABLE events');
    await conn.query('TRUNCATE TABLE users');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // 2. Seed 3 users (User A, User B, Admin)
    const passwordHashA = await bcrypt.hash('UserA@1234', 10);
    const passwordHashB = await bcrypt.hash('UserB@1234', 10);
    const passwordHashAdmin = await bcrypt.hash('Admin@1234', 10);

    const usersData = [
      ['User A', 'usera@example.com', passwordHashA, 'USER'],
      ['User B', 'userb@example.com', passwordHashB, 'USER'],
      ['Admin User', 'admin@example.com', passwordHashAdmin, 'ADMIN']
    ];

    for (const u of usersData) {
      await conn.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        u
      );
    }

    // 3. Seed 2 events with different layout types and sections
    const eventsData = [
      {
        title: 'Summer Music Concert 2026',
        description: 'Live summer concert outdoors featuring indie and rock bands',
        venue: 'City Music Amphitheater',
        eventDate: getUtcEventDate(7),
        price: 1500.00,
        category: 'Concert',
        layoutType: 'ARENA',
        sections: [
          { name: 'Floor', code: 'FLR', tier: 'VIP', price: 3000.00, rows: [{ label: 'A', count: 10 }] },
          { name: 'Upper Tier', code: 'UPR', tier: 'STANDARD', price: 1500.00, rows: [{ label: 'A', count: 10 }] }
        ]
      },
      {
        title: 'Global Tech Conference 2026',
        description: 'Annual gathering of cloud computing and AI developers',
        venue: 'Convention Center Hall A',
        eventDate: getUtcEventDate(14),
        price: 2500.00,
        category: 'Conference',
        layoutType: 'AUDITORIUM',
        sections: [
          { name: 'Left Block', code: 'LB', tier: 'STANDARD', price: 2500.00, rows: [{ label: 'A', count: 5 }] },
          { name: 'Center Block', code: 'CB', tier: 'PREMIUM', price: 3500.00, rows: [{ label: 'A', count: 10 }] },
          { name: 'Right Block', code: 'RB', tier: 'STANDARD', price: 2500.00, rows: [{ label: 'A', count: 5 }] }
        ]
      }
    ];

    for (const ev of eventsData) {
      const [eventResult] = await conn.query(
        `INSERT INTO events (title, description, venue, event_date, price, category, layout_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ev.title, ev.description, ev.venue, ev.eventDate, ev.price, ev.category, ev.layoutType]
      );
      const eventId = eventResult.insertId;

      const seatValues = [];
      for (const sec of ev.sections) {
        for (const r of sec.rows) {
          for (let col = 1; col <= r.count; col++) {
            const seatNumber = `${sec.code}-${r.label}${col}`;
            seatValues.push([eventId, sec.name, seatNumber, r.label, col, sec.tier, sec.price, 'AVAILABLE']);
          }
        }
      }

      await conn.query(
        'INSERT INTO seats (event_id, section, seat_number, row_label, seat_col, tier, price, status) VALUES ?',
        [seatValues]
      );
    }
  } finally {
    conn.release();
  }
}

async function closeTestDb() {
  if (helperPool) {
    await helperPool.end();
    helperPool = null;
  }
}

module.exports = {
  applyTestSchema,
  seedTestDatabase,
  closeTestDb,
  getHelperPool
};
