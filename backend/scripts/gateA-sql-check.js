const { pool } = require('../src/config/database');

async function checkGateA() {
  console.log('================================================================');
  console.log('GATE A SQL VERIFICATION');
  console.log('================================================================\n');

  // Check 1: Each seat's price equals its section's price (0 distinct price variance per section)
  console.log('[CHECK 1] Proving each seat\'s price equals its section\'s price...');
  const [varianceRows] = await pool.query(`
    SELECT event_id, section, COUNT(DISTINCT price) AS distinct_prices, COUNT(*) AS seat_count, MIN(price) AS price
    FROM seats
    GROUP BY event_id, section
    HAVING distinct_prices > 1
  `);

  if (varianceRows.length > 0) {
    console.error('FAILED: Found sections with multiple seat prices:', varianceRows);
    process.exit(1);
  }
  console.log('  ✔ PASS: Every seat in every section has an identical, consistent price (0 variances across all sections).\n');

  // Print section price list
  const [sectionList] = await pool.query(`
    SELECT e.layout_type, s.event_id, s.section, s.tier, s.price, COUNT(*) AS seats
    FROM seats s
    JOIN events e ON s.event_id = e.event_id
    GROUP BY e.layout_type, s.event_id, s.section, s.tier, s.price
    ORDER BY s.event_id, s.price DESC
  `);
  console.log('  Sample Section Pricing Table:');
  for (const r of sectionList.slice(0, 10)) {
    console.log(`    - Event #${r.event_id} [${r.layout_type}] ${r.section.padEnd(14)} (${r.tier.padEnd(8)}) => ₹${Number(r.price).toFixed(2)} (${r.seats} seats)`);
  }
  console.log(`    ... (${sectionList.length} total sections verified)\n`);

  // Check 2: For every booking: total_amount = SUM(price_paid) of its booking_seats
  console.log('[CHECK 2] Proving for every booking: total_amount = SUM(price_paid) of its booking_seats...');
  const [bookingMismatch] = await pool.query(`
    SELECT 
      b.booking_id,
      b.booking_reference,
      b.total_amount,
      SUM(bs.price_paid) AS sum_price_paid,
      (b.total_amount - SUM(bs.price_paid)) AS diff
    FROM bookings b
    JOIN booking_seats bs ON b.booking_id = bs.booking_id
    GROUP BY b.booking_id, b.booking_reference, b.total_amount
    HAVING ABS(diff) > 0.001
  `);

  if (bookingMismatch.length > 0) {
    console.error('FAILED: Found bookings where total_amount != SUM(price_paid):', bookingMismatch);
    process.exit(1);
  }
  console.log('  ✔ PASS: 0 violations found. For every booking in the database, total_amount strictly equals SUM(price_paid)!\n');

  const [bookingSummary] = await pool.query(`
    SELECT 
      b.booking_id,
      b.booking_reference,
      b.total_amount,
      COUNT(bs.booking_seat_id) AS seats_booked,
      SUM(bs.price_paid) AS sum_price_paid
    FROM bookings b
    JOIN booking_seats bs ON b.booking_id = bs.booking_id
    GROUP BY b.booking_id, b.booking_reference, b.total_amount
    ORDER BY b.booking_id
  `);
  console.log('  Verified Bookings:');
  for (const b of bookingSummary) {
    console.log(`    - Booking #${b.booking_id} (${b.booking_reference}): total_amount = ₹${Number(b.total_amount).toFixed(2)}, SUM(price_paid) = ₹${Number(b.sum_price_paid).toFixed(2)} (${b.seats_booked} seats) [MATCH]`);
  }

  console.log('\n================================================================');
  console.log('GATE A SQL VERIFICATION ALL PASSED!');
  console.log('================================================================');
  process.exit(0);
}

checkGateA().catch((err) => {
  console.error(err);
  process.exit(1);
});
