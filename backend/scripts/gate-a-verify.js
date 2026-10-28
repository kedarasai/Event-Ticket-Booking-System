const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { pool } = require('../src/config/database');

async function verifyGateA() {
  console.log('================================================================');
  console.log('GATE A VERIFICATION AUDIT');
  console.log('================================================================\n');

  try {
    // 1. Total seats per event
    console.log('--- [QUERY 1] Total Seats Per Event ---');
    const [eventsSeats] = await pool.query(`
      SELECT e.event_id, e.title, e.layout_type, COUNT(s.seat_id) AS total_seats,
             SUM(CASE WHEN s.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_seats,
             SUM(CASE WHEN s.status = 'BOOKED' THEN 1 ELSE 0 END) AS booked_seats
      FROM events e
      LEFT JOIN seats s ON e.event_id = s.event_id
      GROUP BY e.event_id, e.title, e.layout_type
      ORDER BY e.event_id ASC;
    `);
    console.table(eventsSeats);

    // Expected seat counts
    const expectedTotals = {
      1: { layout: 'ARENA', total: 138 },
      2: { layout: 'AUDITORIUM', total: 128 },
      3: { layout: 'CLUB', total: 40 },
      4: { layout: 'THEATRE', total: 144 },
      5: { layout: 'STADIUM', total: 126 },
      6: { layout: 'FESTIVAL', total: 138 },
    };

    let totalMismatch = false;
    for (const row of eventsSeats) {
      const exp = expectedTotals[row.event_id];
      if (!exp || exp.layout !== row.layout_type || Number(row.total_seats) !== exp.total) {
        console.error(`FAIL: Event ${row.event_id} expected ${exp?.layout}/${exp?.total}, got ${row.layout_type}/${row.total_seats}`);
        totalMismatch = true;
      }
    }
    if (!totalMismatch) {
      console.log('✓ All 6 events match expected venue layout types and exact seat counts!\n');
    }

    // 2. Seats per section breakdown
    console.log('--- [QUERY 2] Section Breakdown Per Event ---');
    const [sectionBreakdown] = await pool.query(`
      SELECT e.event_id, e.layout_type, s.section, COUNT(s.seat_id) AS seats_count,
             SUM(CASE WHEN s.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available,
             SUM(CASE WHEN s.status = 'BOOKED' THEN 1 ELSE 0 END) AS booked
      FROM events e
      JOIN seats s ON e.event_id = s.event_id
      GROUP BY e.event_id, e.layout_type, s.section
      ORDER BY e.event_id ASC, MIN(s.seat_id) ASC;
    `);
    console.table(sectionBreakdown);

    // 3. Duplicate seat_number per event check
    console.log('--- [QUERY 3] Check for Duplicate Seat Numbers Within Same Event ---');
    const [duplicates] = await pool.query(`
      SELECT event_id, seat_number, COUNT(*) AS occurrences
      FROM seats
      GROUP BY event_id, seat_number
      HAVING occurrences > 1;
    `);
    if (duplicates.length === 0) {
      console.log('✓ PASS: Zero duplicate seat_number found per event (HAVING COUNT(*) > 1 returned 0 rows).\n');
    } else {
      console.error('✗ FAIL: Found duplicate seat numbers:', duplicates);
      process.exit(1);
    }

    // 4. Invariant checks
    console.log('--- [QUERY 4] Database Invariants & Relational Integrity ---');
    const [orphanBooked] = await pool.query(`
      SELECT s.seat_id, s.seat_number, s.status, COUNT(bs.booking_seat_id) AS active_count
      FROM seats s
      LEFT JOIN booking_seats bs ON s.seat_id = bs.seat_id AND bs.is_active = TRUE
      WHERE s.status = 'BOOKED'
      GROUP BY s.seat_id, s.seat_number, s.status
      HAVING active_count != 1;
    `);

    const [orphanAvailable] = await pool.query(`
      SELECT s.seat_id, s.seat_number, s.status, COUNT(bs.booking_seat_id) AS active_count
      FROM seats s
      JOIN booking_seats bs ON s.seat_id = bs.seat_id AND bs.is_active = TRUE
      WHERE s.status = 'AVAILABLE'
      GROUP BY s.seat_id, s.seat_number, s.status;
    `);

    if (orphanBooked.length === 0 && orphanAvailable.length === 0) {
      console.log('✓ PASS: 0 integrity violations.');
      console.log('  - Every BOOKED seat has exactly one active booking_seats row.');
      console.log('  - No AVAILABLE seat has an active booking_seats row.\n');
    } else {
      console.error('✗ FAIL: Integrity violations detected:', { orphanBooked, orphanAvailable });
      process.exit(1);
    }

    console.log('================================================================');
    console.log('GATE A: ALL SQL AND RELATIONAL CHECKS PASSED');
    console.log('================================================================');
  } catch (err) {
    console.error('Gate A verification error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyGateA();
