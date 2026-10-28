/**
 * backend/scripts/qa-checklist-audit.js
 * Comprehensive automated QA checklist verification for Items A, E, F, G, J.
 */

const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { pool } = require('../src/config/database');

const BASE_URL = 'http://localhost:5000/api/v1';

async function req(endpoint, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {})
    }
  });

  let body = null;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, ok: res.ok, body };
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`\x1b[31m[FAILED ASSERTION]\x1b[0m ${msg}`);
    throw new Error(msg);
  }
}

async function runQAAudit() {
  console.log('================================================================');
  console.log('QA CHECKLIST AUTOMATED AUDIT (TicketFlow)');
  console.log('================================================================\n');

  const ts = Date.now();
  const userA = { email: `qa_user_a_${ts}@example.com`, pass: 'TestPass@123', name: 'QA User A' };
  const userB = { email: `qa_user_b_${ts}@example.com`, pass: 'TestPass@123', name: 'QA User B' };

  let tokenA = null;
  let tokenB = null;

  // ---------------------------------------------------------------------------
  // CHECKLIST A: Auth
  // ---------------------------------------------------------------------------
  console.log('--- CHECKLIST A: Auth ---');
  // Register
  const regA = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: userA.name, email: userA.email, password: userA.pass })
  });
  assert(regA.status === 201 && regA.body?.data?.token, 'Register User A failed');
  tokenA = regA.body.data.token;
  console.log('  [PASS] Register (201, token returned)');

  // Login
  const logA = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: userA.email, password: userA.pass })
  });
  assert(logA.status === 200 && logA.body?.data?.token, 'Login User A failed');
  tokenA = logA.body.data.token;
  console.log('  [PASS] Login (200, JWT returned)');

  // Refresh persistence (/auth/me with valid token)
  const meA = await req('/auth/me', { headers: { Authorization: `Bearer ${tokenA}` } });
  assert(meA.status === 200 && meA.body?.data?.user?.email === userA.email, '/auth/me session persistence failed');
  console.log('  [PASS] Refresh persistence (/auth/me validated successfully)');

  // Protected redirects / 401 handling (unauthenticated access)
  const noAuth = await req('/bookings/my');
  assert(noAuth.status === 401, 'Unauthenticated request should return 401');
  console.log('  [PASS] Protected routes reject unauthorized requests (401)');

  // Expired / Invalid token handling
  const badToken = await req('/auth/me', { headers: { Authorization: 'Bearer invalid.token.value' } });
  assert(badToken.status === 401, 'Invalid token should return 401');
  console.log('  [PASS] Expired / Invalid token cleanly rejected with 401');

  // Register User B for multi-user tests
  const regB = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: userB.name, email: userB.email, password: userB.pass })
  });
  tokenB = regB.body.data.token;

  // ---------------------------------------------------------------------------
  // CHECKLIST E: Booking Concurrency & Edge Cases
  // ---------------------------------------------------------------------------
  console.log('\n--- CHECKLIST E: Booking Concurrency & Idempotency ---');
  // Find event 2 available seats
  const eventId = 2; // Symphony of Strings
  const seatsRes = await req(`/events/${eventId}/seats`);
  const availSeats = seatsRes.body.data.seats.filter((s) => s.status === 'AVAILABLE');
  assert(availSeats.length >= 6, 'Need at least 6 available seats for event 2');

  const seat1 = availSeats[0].seatId;
  const seat2 = availSeats[1].seatId;
  const seat3 = availSeats[2].seatId;
  const seat4 = availSeats[3].seatId;
  const seat5 = availSeats[4].seatId;
  const seat6 = availSeats[5].seatId;

  // 1. Success booking
  const idemKey1 = crypto.randomUUID();
  const bookSuccess = await req('/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}`, 'Idempotency-Key': idemKey1 },
    body: JSON.stringify({ eventId, seatIds: [seat1] })
  });
  assert(bookSuccess.status === 201, 'Booking success failed');
  const bookingAId = bookSuccess.body.data.bookingId;
  const bookingARef = bookSuccess.body.data.bookingReference;
  console.log(`  [PASS] Booking success (201, ID ${bookingAId}, Ref ${bookingARef})`);

  // 2. Two-browser conflict (User B attempts to book seat1 already booked by User A)
  const conflictRes = await req('/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ eventId, seatIds: [seat1] })
  });
  assert(conflictRes.status === 409, `Expected 409 conflict, got ${conflictRes.status}`);
  console.log('  [PASS] Two-browser conflict detected and rejected with 409');

  // 3. Partial conflict (User B tries to book 3 seats: [seat2, seat1, seat3], where seat1 is already taken)
  // CRITICAL: Atomic rollback test - NEITHER seat2 NOR seat3 should become booked!
  const partialRes = await req('/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ eventId, seatIds: [seat2, seat1, seat3] })
  });
  assert(partialRes.status === 409, `Expected 409 on partial conflict, got ${partialRes.status}`);

  // Verify seat2 and seat3 remain AVAILABLE in DB (Atomic rollback verification)
  const [dbPartialSeats] = await pool.query(
    'SELECT seat_id, status FROM seats WHERE seat_id IN (?, ?)',
    [seat2, seat3]
  );
  assert(dbPartialSeats.every((s) => s.status === 'AVAILABLE'), 'Partial conflict failed to rollback other seats!');
  console.log('  [PASS] Partial conflict (1 of 3 taken): 409 returned and atomic rollback verified (0 seats booked)');

  // 4. Double-click confirm / idempotency retry:
  // Repeating the EXACT same request with same idempotency key must return original booking (200)
  const replayRes = await req('/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}`, 'Idempotency-Key': idemKey1 },
    body: JSON.stringify({ eventId, seatIds: [seat1] })
  });
  assert(replayRes.status === 200, `Expected 200 on idempotent replay, got ${replayRes.status}`);
  assert(replayRes.body.data.bookingId === bookingAId, 'Replayed booking ID mismatch');
  console.log('  [PASS] Double-click / retry with same Idempotency-Key returns original booking (200, no duplicates)');

  // 5. Network drop simulation: same key with different payload must return 409 conflict
  const diffPayloadRes = await req('/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}`, 'Idempotency-Key': idemKey1 },
    body: JSON.stringify({ eventId, seatIds: [seat4] })
  });
  assert(diffPayloadRes.status === 409, `Expected 409 on payload mismatch for same key, got ${diffPayloadRes.status}`);
  console.log('  [PASS] Same Idempotency-Key with different payload rejected with 409 Conflict');

  // ---------------------------------------------------------------------------
  // CHECKLIST F: Ticket
  // ---------------------------------------------------------------------------
  console.log('\n--- CHECKLIST F: Ticket ---');
  // 403 Forbidden: User B cannot access User A's booking
  const forbiddenTicket = await req(`/bookings/${bookingAId}`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert(forbiddenTicket.status === 403, `Expected 403 for non-owner, got ${forbiddenTicket.status}`);
  console.log('  [PASS] Non-owner access to booking blocked with 403');

  // 404 Not Found: Non-existent booking
  const missingTicket = await req('/bookings/9999999', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(missingTicket.status === 404, `Expected 404 for missing booking, got ${missingTicket.status}`);
  console.log('  [PASS] Non-existent booking returns 404');

  // ---------------------------------------------------------------------------
  // CHECKLIST G: My Bookings & Rebooking
  // ---------------------------------------------------------------------------
  console.log('\n--- CHECKLIST G: My Bookings, Cancellation & Seat Release ---');
  // Get my bookings
  const myB = await req('/bookings/my', { headers: { Authorization: `Bearer ${tokenA}` } });
  assert(myB.status === 200 && myB.body.data.bookings.length >= 1, 'My bookings list failed');
  console.log(`  [PASS] My bookings retrieved (${myB.body.data.bookings.length} bookings)`);

  // Cancel booking
  const cancelRes = await req(`/bookings/${bookingAId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(cancelRes.status === 200 && cancelRes.body.data.status === 'CANCELLED', 'Cancel booking failed');
  console.log(`  [PASS] Booking ${bookingARef} cancelled successfully`);

  // Verify seat1 released back to AVAILABLE in DB
  const [dbReleased] = await pool.query('SELECT status FROM seats WHERE seat_id = ?', [seat1]);
  assert(dbReleased[0].status === 'AVAILABLE', `Seat should be AVAILABLE, but is ${dbReleased[0].status}`);
  console.log('  [PASS] Seat released back to AVAILABLE');

  // Rebook the released seat by User B
  const rebookRes = await req('/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ eventId, seatIds: [seat1] })
  });
  assert(rebookRes.status === 201, `Rebook failed: status ${rebookRes.status}`);
  console.log(`  [PASS] Released seat successfully rebooked by User B (Ref: ${rebookRes.body.data.bookingReference})`);

  // ---------------------------------------------------------------------------
  // CHECKLIST J: DB Integrity SQL Audit
  // ---------------------------------------------------------------------------
  console.log('\n--- CHECKLIST J: Database Integrity SQL Audit ---');
  const [bookedViolations] = await pool.query(`
    SELECT s.seat_id, s.seat_number, s.status, COUNT(bs.booking_seat_id) AS active_count
    FROM seats s
    LEFT JOIN booking_seats bs ON s.seat_id = bs.seat_id AND bs.is_active = TRUE
    WHERE s.status = 'BOOKED'
    GROUP BY s.seat_id, s.seat_number, s.status
    HAVING active_count != 1;
  `);
  assert(bookedViolations.length === 0, `BOOKED seat violations found: ${bookedViolations.length}`);
  console.log('  [PASS] Query 1: Every BOOKED seat has exactly one active booking_seats row (0 violations)');

  const [availViolations] = await pool.query(`
    SELECT s.seat_id, s.seat_number, s.status, COUNT(bs.booking_seat_id) AS active_count
    FROM seats s
    JOIN booking_seats bs ON s.seat_id = bs.seat_id AND bs.is_active = TRUE
    WHERE s.status = 'AVAILABLE'
    GROUP BY s.seat_id, s.seat_number, s.status;
  `);
  assert(availViolations.length === 0, `AVAILABLE seat violations found: ${availViolations.length}`);
  console.log('  [PASS] Query 2: No AVAILABLE seat has an active booking_seats row (0 violations)');

  const [amountViolations] = await pool.query(`
    SELECT b.booking_id, b.total_amount, SUM(bs.price_paid) AS expected_total
    FROM bookings b
    JOIN booking_seats bs ON b.booking_id = bs.booking_id
    GROUP BY b.booking_id, b.total_amount
    HAVING b.total_amount != expected_total;
  `);
  assert(amountViolations.length === 0, `Total amount violations found: ${amountViolations.length}`);
  console.log('  [PASS] Query 3: Every booking total_amount equals SUM(price_paid) (0 violations)');

  console.log('\n================================================================');
  console.log('ALL PROGRAMMATIC AUDIT CHECKS PASSED WITH 0 FAILURES!');
  console.log('================================================================\n');
}

runQAAudit()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\nQA Audit Failed:', err);
    try { await pool.end(); } catch {}
    process.exit(1);
  });
