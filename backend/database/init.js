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

// Data-driven venue seating plans with tiered pricing rules
const SEAT_PLANS = {
  ARENA: {
    sections: [
      {
        name: 'Floor',
        code: 'FLR',
        tier: 'VIP',
        multiplier: 2.0,
        rows: [
          { label: 'A', count: 10 },
          { label: 'B', count: 10 },
          { label: 'C', count: 10 },
          { label: 'D', count: 10 },
          { label: 'E', count: 10 }
        ]
      },
      {
        name: 'Lower Left',
        code: 'LL',
        tier: 'PREMIUM',
        multiplier: 1.5,
        rows: [
          { label: 'A', count: 4 },
          { label: 'B', count: 5 },
          { label: 'C', count: 5 },
          { label: 'D', count: 6 }
        ]
      },
      {
        name: 'Lower Right',
        code: 'LR',
        tier: 'PREMIUM',
        multiplier: 1.5,
        rows: [
          { label: 'A', count: 4 },
          { label: 'B', count: 5 },
          { label: 'C', count: 5 },
          { label: 'D', count: 6 }
        ]
      },
      {
        name: 'Upper Tier',
        code: 'UPR',
        tier: 'STANDARD',
        multiplier: 1.0,
        rows: [
          { label: 'A', count: 14 },
          { label: 'B', count: 16 },
          { label: 'C', count: 18 }
        ]
      }
    ]
  },
  AUDITORIUM: {
    sections: [
      {
        name: 'Left Block',
        code: 'LB',
        tier: 'STANDARD',
        multiplier: 1.0,
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((label) => ({ label, count: 4 }))
      },
      {
        name: 'Center Block',
        code: 'CB',
        tier: 'PREMIUM',
        multiplier: 1.4,
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((label) => ({ label, count: 8 }))
      },
      {
        name: 'Right Block',
        code: 'RB',
        tier: 'STANDARD',
        multiplier: 1.0,
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((label) => ({ label, count: 4 }))
      }
    ]
  },
  CLUB: {
    sections: [
      {
        name: 'Tables',
        code: '',
        tier: 'PREMIUM',
        multiplier: 1.3,
        rows: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'].map((label) => ({ label, count: 4 })),
        formatSeatNumber: (code, rowLabel, col) => `${rowLabel}-${col}`
      },
      {
        name: 'Bar',
        code: 'BAR',
        tier: 'ECONOMY',
        multiplier: 0.7,
        rows: [{ label: 'B', count: 8 }],
        formatSeatNumber: (code, rowLabel, col) => `${code}-${rowLabel}${col}`
      }
    ]
  },
  THEATRE: {
    sections: [
      {
        name: 'Stalls',
        code: 'STL',
        tier: 'PREMIUM',
        multiplier: 1.5,
        rows: [
          { label: 'A', count: 10 },
          { label: 'B', count: 10 },
          { label: 'C', count: 12 },
          { label: 'D', count: 12 },
          { label: 'E', count: 14 },
          { label: 'F', count: 14 },
          { label: 'G', count: 16 }
        ]
      },
      {
        name: 'Circle',
        code: 'CIR',
        tier: 'STANDARD',
        multiplier: 1.0,
        rows: [
          { label: 'A', count: 14 },
          { label: 'B', count: 14 },
          { label: 'C', count: 16 }
        ]
      },
      {
        name: 'Left Box',
        code: 'LBX',
        tier: 'VIP',
        multiplier: 2.2,
        rows: [
          { label: 'A', count: 3 },
          { label: 'B', count: 3 }
        ]
      },
      {
        name: 'Right Box',
        code: 'RBX',
        tier: 'VIP',
        multiplier: 2.2,
        rows: [
          { label: 'A', count: 3 },
          { label: 'B', count: 3 }
        ]
      }
    ]
  },
  STADIUM: {
    sections: [
      { name: 'North Stand', code: 'NTH', tier: 'VIP', multiplier: 2.0, rows: [{ label: 'A', count: 10 }, { label: 'B', count: 10 }, { label: 'C', count: 10 }] },
      { name: 'NE Corner', code: 'NEC', tier: 'STANDARD', multiplier: 1.0, rows: [{ label: 'A', count: 3 }, { label: 'B', count: 3 }, { label: 'C', count: 3 }] },
      { name: 'East End', code: 'EST', tier: 'ECONOMY', multiplier: 0.7, rows: [{ label: 'A', count: 5 }, { label: 'B', count: 5 }, { label: 'C', count: 5 }] },
      { name: 'SE Corner', code: 'SEC', tier: 'STANDARD', multiplier: 1.0, rows: [{ label: 'A', count: 3 }, { label: 'B', count: 3 }, { label: 'C', count: 3 }] },
      { name: 'South Stand', code: 'STH', tier: 'PREMIUM', multiplier: 1.5, rows: [{ label: 'A', count: 10 }, { label: 'B', count: 10 }, { label: 'C', count: 10 }] },
      { name: 'SW Corner', code: 'SWC', tier: 'STANDARD', multiplier: 1.0, rows: [{ label: 'A', count: 3 }, { label: 'B', count: 3 }, { label: 'C', count: 3 }] },
      { name: 'West End', code: 'WST', tier: 'ECONOMY', multiplier: 0.7, rows: [{ label: 'A', count: 5 }, { label: 'B', count: 5 }, { label: 'C', count: 5 }] },
      { name: 'NW Corner', code: 'NWC', tier: 'STANDARD', multiplier: 1.0, rows: [{ label: 'A', count: 3 }, { label: 'B', count: 3 }, { label: 'C', count: 3 }] }
    ]
  },
  FESTIVAL: {
    sections: [
      {
        name: 'VIP Front',
        code: 'VIP',
        tier: 'VIP',
        multiplier: 2.5,
        rows: [
          { label: 'A', count: 8 },
          { label: 'B', count: 10 },
          { label: 'C', count: 12 }
        ]
      },
      {
        name: 'Zone A',
        code: 'ZNA',
        tier: 'PREMIUM',
        multiplier: 1.5,
        rows: [
          { label: 'A', count: 6 },
          { label: 'B', count: 7 },
          { label: 'C', count: 8 },
          { label: 'D', count: 9 }
        ]
      },
      {
        name: 'Zone B',
        code: 'ZNB',
        tier: 'PREMIUM',
        multiplier: 1.5,
        rows: [
          { label: 'A', count: 6 },
          { label: 'B', count: 7 },
          { label: 'C', count: 8 },
          { label: 'D', count: 9 }
        ]
      },
      {
        name: 'Lawn',
        code: 'LWN',
        tier: 'ECONOMY',
        multiplier: 0.6,
        rows: [
          { label: 'A', count: 14 },
          { label: 'B', count: 16 },
          { label: 'C', count: 18 }
        ]
      }
    ]
  }
};

/**
 * Computes seat price in integer paise, rounded to nearest 10 rupees.
 */
function computeSeatPrice(basePrice, multiplier = 1.0) {
  const basePaise = Math.round(Number(basePrice) * 100);
  const rawPaise = Math.round(basePaise * multiplier);
  const roundedPaise = Math.round(rawPaise / 1000) * 1000;
  return Number((roundedPaise / 100).toFixed(2));
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
    database: targetDb,
    timezone: 'Z',
    dateStrings: false
  });
  await connection.query("SET time_zone = '+00:00'");

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

    console.log('Seeding 6 realistic upcoming events with venue-specific seating plans...');
    const eventsData = [
      {
        title: 'Neon Odyssey: Synthwave World Tour',
        description: 'An immersive retro-futuristic audio-visual concert experience featuring cutting-edge laser synthesis, analog modular synthesizers, and massive holographic displays.',
        venue: 'Cyber Dome, Neo Metropolis',
        eventDate: getUtcEventDate(3),
        price: 1999.00,
        category: 'Concert',
        layoutType: 'ARENA'
      },
      {
        title: 'NextGen AI & Cloud Summit 2026',
        description: 'The premier annual summit bringing together world leaders in generative AI, scalable distributed computing, and autonomous intelligent systems.',
        venue: 'Horizon Grand Convention Center',
        eventDate: getUtcEventDate(7),
        price: 3499.00,
        category: 'Conference',
        layoutType: 'AUDITORIUM'
      },
      {
        title: 'Midnight Chuckles: Standup Comedy Special',
        description: 'A blockbuster two-hour evening of raw, unfiltered standup comedy with top satirical talents and crowd-work maestros.',
        venue: 'The Laugh Garage Arena',
        eventDate: getUtcEventDate(10),
        price: 799.00,
        category: 'Comedy',
        layoutType: 'CLUB'
      },
      {
        title: 'The Phantom Illusion: Live Musical Theatre',
        description: 'A spellbinding theatrical masterpiece reimagining classic Gothic drama through opulent set architecture and world-class live orchestral scoring.',
        venue: 'Royal Opera House',
        eventDate: getUtcEventDate(14),
        price: 1499.00,
        category: 'Theatre',
        layoutType: 'THEATRE'
      },
      {
        title: 'Apex Championship: National Sports Finals',
        description: 'The high-voltage championship decider featuring top athletes in a clash of tactical endurance, precision, and peak athletic excellence.',
        venue: 'Vanguard Multi-Sport Stadium',
        eventDate: getUtcEventDate(21),
        price: 1299.00,
        category: 'Sports',
        layoutType: 'STADIUM'
      },
      {
        title: 'Solaris Light & Sonic Festival',
        description: 'A breathtaking outdoor celebration uniting kinetic light sculptures, world ambient music, international gastronomy, and digital art installations.',
        venue: 'Elysium Open Grounds',
        eventDate: getUtcEventDate(30),
        price: 4999.00,
        category: 'Festival',
        layoutType: 'FESTIVAL'
      }
    ];

    // Pre-booking patterns (~12% per event) covering multiple sections
    const preBookedPatterns = [
      // 1. ARENA (Concert - 16 of 138 booked: 11.6%)
      ['FLR-A4', 'FLR-A5', 'FLR-B3', 'FLR-C7', 'FLR-D2', 'FLR-E8', 'LL-A2', 'LL-B3', 'LL-C4', 'LR-A3', 'LR-B2', 'LR-D5', 'UPR-A5', 'UPR-B8', 'UPR-B9', 'UPR-C12'],
      // 2. AUDITORIUM (Conference - 15 of 128 booked: 11.7%)
      ['LB-A2', 'LB-C3', 'LB-E1', 'LB-G4', 'CB-A4', 'CB-B5', 'CB-C2', 'CB-D7', 'CB-E3', 'CB-F6', 'CB-H4', 'RB-B2', 'RB-D1', 'RB-F3', 'RB-H4'],
      // 3. CLUB (Comedy - 5 of 40 booked: 12.5%)
      ['T1-2', 'T3-4', 'T5-1', 'T7-3', 'BAR-B4'],
      // 4. THEATRE (Theatre - 17 of 144 booked: 11.8%)
      ['STL-A5', 'STL-B6', 'STL-C3', 'STL-D8', 'STL-E4', 'STL-F10', 'STL-G7', 'STL-G8', 'CIR-A4', 'CIR-B7', 'CIR-B8', 'CIR-C11', 'CIR-C12', 'LBX-A2', 'LBX-B1', 'RBX-A1', 'RBX-B3'],
      // 5. STADIUM (Sports - 15 of 126 booked: 11.9%)
      ['NTH-A3', 'NTH-B5', 'NTH-C8', 'NEC-A1', 'NEC-B2', 'EST-A2', 'EST-C4', 'SEC-B1', 'STH-A4', 'STH-B7', 'STH-C2', 'SWC-A2', 'WST-A3', 'WST-B4', 'NWC-C1'],
      // 6. FESTIVAL (Festival - 16 of 138 booked: 11.6%)
      ['VIP-A3', 'VIP-B5', 'VIP-C8', 'VIP-C9', 'ZNA-A2', 'ZNA-B4', 'ZNA-C3', 'ZNA-D7', 'ZNB-A3', 'ZNB-B2', 'ZNB-C6', 'ZNB-D5', 'LWN-A4', 'LWN-B8', 'LWN-B9', 'LWN-C14']
    ];

    let totalSeatsInserted = 0;
    let totalBookingsInserted = 0;
    let totalBookingSeatsInserted = 0;

    const perEventSummaries = [];

    for (let i = 0; i < eventsData.length; i++) {
      const ev = eventsData[i];
      const plan = SEAT_PLANS[ev.layoutType];

      const [eventResult] = await connection.query(
        `INSERT INTO events (title, description, venue, event_date, price, category, layout_type, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
        [ev.title, ev.description, ev.venue, ev.eventDate, ev.price, ev.category, ev.layoutType]
      );
      const eventId = eventResult.insertId;

      // Generate seats from venue plan
      const seatValues = [];
      const sectionBreakdown = {};

      for (const sec of plan.sections) {
        let secCount = 0;
        const tier = sec.tier || 'STANDARD';
        const multiplier = sec.multiplier !== undefined ? sec.multiplier : 1.0;
        const price = computeSeatPrice(ev.price, multiplier);

        for (const row of sec.rows) {
          for (let col = 1; col <= row.count; col++) {
            const seatNumber = sec.formatSeatNumber
              ? sec.formatSeatNumber(sec.code, row.label, col)
              : `${sec.code}-${row.label}${col}`;
            seatValues.push([eventId, sec.name, seatNumber, row.label, col, tier, price, 'AVAILABLE']);
            secCount++;
          }
        }
        sectionBreakdown[sec.name] = { count: secCount, tier, price };
      }

      await connection.query(
        'INSERT INTO seats (event_id, section, seat_number, row_label, seat_col, tier, price, status) VALUES ?',
        [seatValues]
      );
      totalSeatsInserted += seatValues.length;

      // Seed ~12% pre-booked seats
      const preBookedNumbers = preBookedPatterns[i];
      const [selectedSeats] = await connection.query(
        'SELECT seat_id, seat_number, price FROM seats WHERE event_id = ? AND seat_number IN (?)',
        [eventId, preBookedNumbers]
      );

      const seatIds = selectedSeats.map((s) => s.seat_id);
      let totalPaise = 0;
      for (const s of selectedSeats) {
        totalPaise += Math.round(Number(s.price) * 100);
      }
      const totalAmount = Number((totalPaise / 100).toFixed(2));
      const bookingReference = `BK-${eventId}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

      // Create confirmed booking for seed-guest
      const [bookingResult] = await connection.query(
        `INSERT INTO bookings (user_id, event_id, booking_reference, status, total_amount)
         VALUES (?, ?, ?, 'CONFIRMED', ?)`,
        [guestUserId, eventId, bookingReference, totalAmount]
      );
      const bookingId = bookingResult.insertId;
      totalBookingsInserted++;

      // Create active booking_seats rows with price_paid snapshot
      const bookingSeatValues = selectedSeats.map((s) => [
        bookingId,
        s.seat_id,
        Number(s.price),
        true
      ]);
      await connection.query(
        'INSERT INTO booking_seats (booking_id, seat_id, price_paid, is_active) VALUES ?',
        [bookingSeatValues]
      );
      totalBookingSeatsInserted += bookingSeatValues.length;

      // Mark the seats as BOOKED in seats table
      await connection.query(
        'UPDATE seats SET status = "BOOKED" WHERE seat_id IN (?)',
        [seatIds]
      );

      // Query tier table breakdown
      const [tierRows] = await connection.query(
        `SELECT tier, price, COUNT(seat_id) AS seat_count,
                COALESCE(SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END), 0) AS available_count
         FROM seats
         WHERE event_id = ?
         GROUP BY tier, price
         ORDER BY price DESC`,
        [eventId]
      );

      perEventSummaries.push({
        id: eventId,
        title: ev.title,
        layoutType: ev.layoutType,
        totalSeats: seatValues.length,
        bookedCount: seatIds.length,
        totalAmount,
        tiers: tierRows
      });
    }

    console.log(`\n--- Per-Event Tier Table & Seating Summary ---`);
    for (const s of perEventSummaries) {
      console.log(`\nEvent #${s.id}: ${s.title} [${s.layoutType}] (Pre-booked total: ₹${s.totalAmount.toFixed(2)})`);
      console.log(`  Tier Table (tier | price | seat_count | available):`);
      for (const t of s.tiers) {
        console.log(`    - ${t.tier.padEnd(8)} | ₹${Number(t.price).toFixed(2).padStart(8)} | ${String(t.seat_count).padStart(3)} seats | ${String(t.available_count).padStart(3)} available`);
      }
    }

    console.log(`\n--- Database Seeding Summary (${targetDb}) ---`);
    console.log(`Users seeded:        ${usersData.length}`);
    console.log(`Events seeded:       ${eventsData.length}`);
    console.log(`Seats seeded:        ${totalSeatsInserted}`);
    console.log(`Bookings seeded:     ${totalBookingsInserted} (1 per event by seed-guest)`);
    console.log(`BookingSeats seeded: ${totalBookingSeatsInserted} (is_active=true)`);
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
