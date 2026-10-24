const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const applySchema = require('../scripts/apply-schema');

// Support loading appropriate environment variables
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

function getUtcEventDate(daysAhead) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(19, 0, 0, 0); // 7:00 PM UTC
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function initDatabase(dbOverride) {
  const targetDb = dbOverride || process.env.DB_NAME || 'ticket_booking';
  console.log(`\n========================================`);
  console.log(`Initializing database: ${targetDb}`);
  console.log(`========================================`);

  // Step 1: Drop and recreate schema from schema.sql
  await applySchema(targetDb);

  // Step 2: Establish dedicated connection for seeding
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: targetDb
  });

  try {
    console.log('Seeding demo users...');
    const demoPasswordHash = await bcrypt.hash('Demo@1234', 10);
    const adminPasswordHash = await bcrypt.hash('Admin@1234', 10);
    const guestPasswordHash = await bcrypt.hash('Guest@Seed2026!', 10);

    const usersData = [
      ['Demo User', 'demo@example.com', demoPasswordHash, 'USER'],
      ['Admin User', 'admin@example.com', adminPasswordHash, 'ADMIN'],
      ['Seed Guest', 'seed-guest@example.com', guestPasswordHash, 'USER']
    ];

    for (const user of usersData) {
      await connection.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        user
      );
    }

    const [[guestUser]] = await connection.query(
      'SELECT user_id FROM users WHERE email = ?',
      ['seed-guest@example.com']
    );
    const guestUserId = guestUser.user_id;

    console.log('Seeding 6 realistic upcoming events...');
    const eventsData = [
      {
        title: 'Neon Odyssey: Synthwave World Tour',
        description: 'An immersive retro-futuristic audio-visual concert experience featuring cutting-edge laser synthesis, analog modular synthesizers, and massive holographic displays.',
        venue: 'Cyber Dome, Neo Metropolis',
        eventDate: getUtcEventDate(3),
        price: 1999.00,
        category: 'Concert'
      },
      {
        title: 'NextGen AI & Cloud Summit 2026',
        description: 'The premier annual summit bringing together world leaders in generative AI, scalable distributed computing, and autonomous intelligent systems.',
        venue: 'Horizon Grand Convention Center',
        eventDate: getUtcEventDate(7),
        price: 3499.00,
        category: 'Conference'
      },
      {
        title: 'Midnight Chuckles: Standup Comedy Special',
        description: 'A blockbuster two-hour evening of raw, unfiltered standup comedy with top satirical talents and crowd-work maestros.',
        venue: 'The Laugh Garage Arena',
        eventDate: getUtcEventDate(10),
        price: 799.00,
        category: 'Comedy'
      },
      {
        title: 'The Phantom Illusion: Live Musical Theatre',
        description: 'A spellbinding theatrical masterpiece reimagining classic Gothic drama through opulent set architecture and world-class live orchestral scoring.',
        venue: 'Royal Opera House',
        eventDate: getUtcEventDate(14),
        price: 1499.00,
        category: 'Theatre'
      },
      {
        title: 'Apex Championship: National Sports Finals',
        description: 'The high-voltage championship decider featuring top athletes in a clash of tactical endurance, precision, and peak athletic excellence.',
        venue: 'Vanguard Multi-Sport Stadium',
        eventDate: getUtcEventDate(21),
        price: 1299.00,
        category: 'Sports'
      },
      {
        title: 'Solaris Light & Sonic Festival',
        description: 'A breathtaking outdoor celebration uniting kinetic light sculptures, world ambient music, international gastronomy, and digital art installations.',
        venue: 'Elysium Open Grounds',
        eventDate: getUtcEventDate(30),
        price: 4999.00,
        category: 'Festival'
      }
    ];

    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const colsCount = 12;

    // Scattered seat selections for each event (12 seats out of 96 = 12.5% ~12%)
    const scatteredSeatPatterns = [
      ['A4', 'A5', 'B6', 'B7', 'C3', 'C8', 'D5', 'D6', 'E4', 'F9', 'G2', 'H11'],
      ['A1', 'A12', 'B3', 'B10', 'C5', 'C7', 'D4', 'E8', 'F2', 'G6', 'G7', 'H12'],
      ['A6', 'A7', 'B5', 'B8', 'C6', 'D2', 'D11', 'E5', 'E6', 'F4', 'G9', 'H3'],
      ['A2', 'B4', 'B9', 'C1', 'C12', 'D6', 'D7', 'E3', 'F8', 'G5', 'H6', 'H7'],
      ['A3', 'A10', 'B2', 'C4', 'C9', 'D5', 'E7', 'E10', 'F1', 'G8', 'H4', 'H9'],
      ['A8', 'B1', 'B11', 'C7', 'D3', 'D10', 'E2', 'F6', 'F7', 'G4', 'H5', 'H10']
    ];

    let totalSeatsInserted = 0;
    let totalBookingsInserted = 0;
    let totalBookingSeatsInserted = 0;

    for (let i = 0; i < eventsData.length; i++) {
      const ev = eventsData[i];
      const [eventResult] = await connection.query(
        `INSERT INTO events (title, description, venue, event_date, price, category, image_url)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
        [ev.title, ev.description, ev.venue, ev.eventDate, ev.price, ev.category]
      );
      const eventId = eventResult.insertId;

      // Seed 96 seats (8 rows A-H x 12 cols)
      const seatValues = [];
      for (const rowLabel of rows) {
        for (let col = 1; col <= colsCount; col++) {
          const seatNumber = `${rowLabel}${col}`;
          seatValues.push([eventId, seatNumber, rowLabel, col, 'AVAILABLE']);
        }
      }

      await connection.query(
        'INSERT INTO seats (event_id, seat_number, row_label, seat_col, status) VALUES ?',
        [seatValues]
      );
      totalSeatsInserted += seatValues.length;

      // Query seat IDs for the selected scattered seats for this event
      const selectedSeatNumbers = scatteredSeatPatterns[i];
      const [selectedSeats] = await connection.query(
        'SELECT seat_id, seat_number FROM seats WHERE event_id = ? AND seat_number IN (?)',
        [eventId, selectedSeatNumbers]
      );

      const seatIds = selectedSeats.map((s) => s.seat_id);
      const bookingSeatCount = seatIds.length;
      const totalAmount = Number((ev.price * bookingSeatCount).toFixed(2));
      const bookingReference = `BK-${eventId}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

      // Create confirmed booking for seed-guest
      const [bookingResult] = await connection.query(
        `INSERT INTO bookings (user_id, event_id, booking_reference, status, total_amount)
         VALUES (?, ?, ?, 'CONFIRMED', ?)`,
        [guestUserId, eventId, bookingReference, totalAmount]
      );
      const bookingId = bookingResult.insertId;
      totalBookingsInserted++;

      // Create active booking_seats rows
      const bookingSeatValues = seatIds.map((seatId) => [bookingId, seatId, true]);
      await connection.query(
        'INSERT INTO booking_seats (booking_id, seat_id, is_active) VALUES ?',
        [bookingSeatValues]
      );
      totalBookingSeatsInserted += bookingSeatValues.length;

      // Mark the seats as BOOKED in seats table
      await connection.query(
        'UPDATE seats SET status = "BOOKED" WHERE seat_id IN (?)',
        [seatIds]
      );
    }

    console.log(`\n--- Database Seeding Summary (${targetDb}) ---`);
    console.log(`Users seeded:        ${usersData.length}`);
    console.log(`Events seeded:       ${eventsData.length}`);
    console.log(`Seats seeded:        ${totalSeatsInserted} (96 per event)`);
    console.log(`Bookings seeded:     ${totalBookingsInserted} (1 per event by seed-guest)`);
    console.log(`BookingSeats seeded: ${totalBookingSeatsInserted} (12 per event, is_active=true)`);
    console.log(`Database initialization completed successfully.\n`);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  const dbOverride = process.argv[2] || process.env.DB_NAME;
  initDatabase(dbOverride)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Initialization failed:', err);
      process.exit(1);
    });
}

module.exports = initDatabase;
