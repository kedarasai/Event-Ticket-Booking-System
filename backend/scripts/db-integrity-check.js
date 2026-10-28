/**
 * backend/scripts/db-integrity-check.js
 * Validates database integrity invariants:
 * 1. No BOOKED seat without exactly one active booking_seats row.
 * 2. No AVAILABLE seat with an active booking_seats row.
 * 3. No booking whose total_amount differs from (event price * seat count).
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { pool } = require('../src/config/database');

async function runIntegrityChecks() {
  console.log('================================================================');
  console.log('DATABASE INTEGRITY SQL AUDIT');
  console.log('================================================================\n');

  let totalViolations = 0;

  try {
    // 1. Check: BOOKED seats must have EXACTLY 1 active booking_seats row
    console.log('[CHECK 1] Verifying all BOOKED seats have exactly 1 active booking_seats row...');
    const [bookedViolations] = await pool.query(`
      SELECT s.seat_id, s.seat_number, s.status, COUNT(bs.booking_seat_id) AS active_count
      FROM seats s
      LEFT JOIN booking_seats bs ON s.seat_id = bs.seat_id AND bs.is_active = TRUE
      WHERE s.status = 'BOOKED'
      GROUP BY s.seat_id, s.seat_number, s.status
      HAVING active_count != 1;
    `);

    if (bookedViolations.length === 0) {
      console.log('  \x1b[32m[PASS]\x1b[0m 0 violations found. Every BOOKED seat has exactly one active booking_seats row.\n');
    } else {
      console.error(`  \x1b[31m[FAIL]\x1b[0m Found ${bookedViolations.length} violations:`, bookedViolations);
      totalViolations += bookedViolations.length;
    }

    // 2. Check: AVAILABLE seats must have ZERO active booking_seats rows
    console.log('[CHECK 2] Verifying no AVAILABLE seat has an active booking_seats row...');
    const [availableViolations] = await pool.query(`
      SELECT s.seat_id, s.seat_number, s.status, COUNT(bs.booking_seat_id) AS active_count
      FROM seats s
      JOIN booking_seats bs ON s.seat_id = bs.seat_id AND bs.is_active = TRUE
      WHERE s.status = 'AVAILABLE'
      GROUP BY s.seat_id, s.seat_number, s.status;
    `);

    if (availableViolations.length === 0) {
      console.log('  \x1b[32m[PASS]\x1b[0m 0 violations found. No AVAILABLE seat has an active booking_seats row.\n');
    } else {
      console.error(`  \x1b[31m[FAIL]\x1b[0m Found ${availableViolations.length} violations:`, availableViolations);
      totalViolations += availableViolations.length;
    }

    // 3. Check: booking total_amount must equal SUM(price_paid) of its booking_seats
    console.log('[CHECK 3] Verifying no booking has total_amount differing from SUM(price_paid)...');
    const [amountViolations] = await pool.query(`
      SELECT b.booking_id, b.total_amount, SUM(bs.price_paid) AS expected_total
      FROM bookings b
      JOIN booking_seats bs ON b.booking_id = bs.booking_id
      GROUP BY b.booking_id, b.total_amount
      HAVING b.total_amount != expected_total;
    `);

    if (amountViolations.length === 0) {
      console.log('  \x1b[32m[PASS]\x1b[0m 0 violations found. All booking total_amounts match SUM(price_paid).\n');
    } else {
      console.error(`  \x1b[31m[FAIL]\x1b[0m Found ${amountViolations.length} violations:`, amountViolations);
      totalViolations += amountViolations.length;
    }

    console.log('================================================================');
    if (totalViolations === 0) {
      console.log('\x1b[32m[GATE AUDIT PASSED] ZERO DATABASE INTEGRITY VIOLATIONS DETECTED!\x1b[0m');
      console.log('================================================================\n');
      process.exit(0);
    } else {
      console.error(`\x1b[31m[GATE AUDIT FAILED] ${totalViolations} DATABASE INTEGRITY VIOLATIONS DETECTED!\x1b[0m`);
      console.log('================================================================\n');
      process.exit(1);
    }
  } catch (err) {
    console.error('Database integrity check query error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runIntegrityChecks();
