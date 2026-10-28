const { pool } = require('../src/config/database');

async function runIntegrityChecks() {
  console.log('===============================================================');
  console.log('                 DATABASE INTEGRITY CHECK RUNNER                ');
  console.log('===============================================================');

  // 1. No BOOKED seat without exactly one active booking_seats row
  const [q1] = await pool.query(`
    SELECT s.seat_id, s.seat_number, s.event_id, COUNT(bs.booking_seat_id) AS active_bs_count
    FROM seats s
    LEFT JOIN booking_seats bs ON s.seat_id = bs.seat_id AND bs.is_active = TRUE
    WHERE s.status = 'BOOKED'
    GROUP BY s.seat_id, s.seat_number, s.event_id
    HAVING active_bs_count != 1
  `);

  // 2. No AVAILABLE seat with an active one
  const [q2] = await pool.query(`
    SELECT s.seat_id, s.seat_number, s.event_id, COUNT(bs.booking_seat_id) AS active_bs_count
    FROM seats s
    JOIN booking_seats bs ON s.seat_id = bs.seat_id AND bs.is_active = TRUE
    WHERE s.status = 'AVAILABLE'
    GROUP BY s.seat_id, s.seat_number, s.event_id
  `);

  // 3. Every booking total_amount = SUM(price_paid) of its seats
  const [q3] = await pool.query(`
    SELECT b.booking_id, b.booking_reference, b.total_amount, ROUND(SUM(bs.price_paid), 2) AS sum_price_paid
    FROM bookings b
    JOIN booking_seats bs ON b.booking_id = bs.booking_id
    GROUP BY b.booking_id, b.booking_reference, b.total_amount
    HAVING b.total_amount != ROUND(SUM(bs.price_paid), 2)
  `);

  // 4. No duplicate seat_number within an event
  const [q4] = await pool.query(`
    SELECT event_id, seat_number, COUNT(*) AS count
    FROM seats
    GROUP BY event_id, seat_number
    HAVING count > 1
  `);

  console.log('[CHECK 1] No BOOKED seat without exactly one active booking_seats row:');
  console.log(`  Violations found: ${q1.length}`);
  if (q1.length > 0) console.table(q1);

  console.log('\n[CHECK 2] No AVAILABLE seat with an active booking_seats row:');
  console.log(`  Violations found: ${q2.length}`);
  if (q2.length > 0) console.table(q2);

  console.log('\n[CHECK 3] Every booking total_amount = SUM(price_paid) of its seats:');
  console.log(`  Violations found: ${q3.length}`);
  if (q3.length > 0) console.table(q3);

  console.log('\n[CHECK 4] No duplicate seat_number within an event:');
  console.log(`  Violations found: ${q4.length}`);
  if (q4.length > 0) console.table(q4);

  const totalViolations = q1.length + q2.length + q3.length + q4.length;
  console.log('===============================================================');
  console.log(`TOTAL INTEGRITY VIOLATIONS: ${totalViolations}`);
  console.log('===============================================================');

  await pool.end();
  process.exit(totalViolations === 0 ? 0 : 1);
}

runIntegrityChecks().catch((err) => {
  console.error('Integrity check failed with error:', err);
  process.exit(1);
});
