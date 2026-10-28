/**
 * scripts/gate8.js
 * GATE validation runner for Phase 8 (POST /api/v1/bookings)
 * 
 * Executes 11 real HTTP scenarios against the API:
 *  1. Single-seat booking (201)
 *  2. Multi-seat booking (201)
 *  3. Re-booking the same seat (409)
 *  4. Multi-seat request where one seat is taken (409, non-booked seats remain AVAILABLE)
 *  5. 9 seats requested (400)
 *  6. Duplicate seat IDs in request (400)
 *  7. Seats from another event (404)
 *  8. Unauthenticated request without token (401)
 *  9. Same Idempotency-Key twice sequentially (200, 1 booking row)
 * 10. Same Idempotency-Key with different payload/seats (409)
 * 11. 5 simultaneous requests with the same Idempotency-Key via Promise.all
 *     (Expected: one 201, four 200, exactly one booking row, no 500s)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { pool } = require('../src/config/database');
const app = require('../src/app');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

let serverInstance = null;

function assert(condition, message) {
  if (!condition) {
    console.error(`\x1b[31m[FAILED]\x1b[0m ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function ensureServerRunning() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (res.ok) {
      console.log(`[INFO] Server already running at ${BASE_URL}`);
      return;
    }
  } catch (_) {
    // Not running, start it
  }

  await new Promise((resolve) => {
    serverInstance = app.listen(PORT, () => {
      console.log(`[INFO] Server started for testing at http://localhost:${PORT}`);
      resolve();
    });
  });
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const { headers, ...restOptions } = options;
  const res = await fetch(url, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {})
    }
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {}

  return {
    status: res.status,
    headers: res.headers,
    body: data
  };
}

async function runGate() {
  console.log('\n===============================================================');
  console.log('       GATE 8: POST /api/v1/bookings VERIFICATION RUNNER       ');
  console.log('===============================================================\n');

  await ensureServerRunning();

  // Step 0: Login demo user to get JWT
  console.log('[STEP 0] Authenticating demo user...');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'demo@example.com',
      password: 'Demo@1234'
    })
  });
  assert(loginRes.status === 200, `Login failed with status ${loginRes.status}`);
  assert(loginRes.body.success === true, 'Login body success was not true');
  const token = loginRes.body.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('  -> Demo user authenticated successfully.\n');

  // Query Event 2 and its available seats
  const eventId = 2;
  const seatsRes = await request(`/events/${eventId}/seats`);
  assert(seatsRes.status === 200, 'Failed to fetch seats for event 2');
  const availableSeats = seatsRes.body.data.seats.filter((s) => s.status === 'AVAILABLE');
  assert(availableSeats.length >= 25, `Not enough available seats in event 2 (found ${availableSeats.length})`);
  console.log(`[INFO] Event 2 has ${availableSeats.length} available seats for testing.\n`);

  // SCENARIO 1: Single-seat booking (201)
  console.log('--- Scenario 1: Single-seat booking (201) ---');
  const s1Seat = availableSeats[0];
  const s1Res = await request('/bookings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      eventId,
      seatIds: [s1Seat.seatId]
    })
  });
  console.log(`  HTTP Status: ${s1Res.status}`);
  console.log(`  Response:`, JSON.stringify(s1Res.body));
  assert(s1Res.status === 201, `Expected 201 but got ${s1Res.status}`);
  assert(s1Res.body.success === true, 'Expected success === true');
  assert(s1Res.body.data.bookingId > 0, 'Expected positive bookingId');
  assert(s1Res.body.data.bookingReference.startsWith('EVT-'), 'Expected EVT- reference');
  assert(s1Res.body.data.status === 'CONFIRMED', 'Expected CONFIRMED status');
  assert(s1Res.body.data.seatIds.length === 1 && s1Res.body.data.seatIds[0] === s1Seat.seatId, 'Seat ID mismatch');
  assert(s1Res.body.data.totalAmount === s1Seat.price, `Total mismatch: expected ${s1Seat.price}, got ${s1Res.body.data.totalAmount}`);
  assert(Array.isArray(s1Res.body.data.seats) && s1Res.body.data.seats[0].price === s1Seat.price, 'Seats array price mismatch');
  console.log('  \x1b[32m✔ Scenario 1 Passed\x1b[0m\n');

  // SCENARIO 2: Multi-seat booking (201)
  console.log('--- Scenario 2: Multi-seat booking (201) ---');
  const s2Seats = [availableSeats[1], availableSeats[2], availableSeats[3]];
  const s2SeatIds = s2Seats.map((s) => s.seatId);
  const expectedS2Total = s2Seats.reduce((sum, s) => sum + Math.round(Number(s.price) * 100), 0) / 100;
  const s2Res = await request('/bookings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      eventId,
      seatIds: s2SeatIds
    })
  });
  console.log(`  HTTP Status: ${s2Res.status}`);
  console.log(`  Response:`, JSON.stringify(s2Res.body));
  assert(s2Res.status === 201, `Expected 201 but got ${s2Res.status}`);
  assert(s2Res.body.data.seatIds.length === 3, 'Expected 3 seatIds');
  assert(s2Res.body.data.totalAmount === expectedS2Total, `Total mismatch: expected ${expectedS2Total}, got ${s2Res.body.data.totalAmount}`);
  assert(Array.isArray(s2Res.body.data.seats) && s2Res.body.data.seats.length === 3, 'Expected 3 seats in response seats array');
  console.log('  \x1b[32m✔ Scenario 2 Passed\x1b[0m\n');

  // SCENARIO 3: Re-booking the same seat (409)
  console.log('--- Scenario 3: Re-booking the same seat (409) ---');
  const s3Res = await request('/bookings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      eventId,
      seatIds: [s1Seat.seatId]
    })
  });
  console.log(`  HTTP Status: ${s3Res.status}`);
  console.log(`  Response:`, JSON.stringify(s3Res.body));
  assert(s3Res.status === 409, `Expected 409 but got ${s3Res.status}`);
  assert(s3Res.body.message === 'One or more selected seats are no longer available.', 'Mismatch in error message');
  console.log('  \x1b[32m✔ Scenario 3 Passed\x1b[0m\n');

  // SCENARIO 4: Multi-seat request where one seat is taken (409)
  console.log('--- Scenario 4: Multi-seat with 1 taken seat (409 & verify other seats remain AVAILABLE) ---');
  const s4Available1 = availableSeats[4];
  const s4Available2 = availableSeats[5];
  const s4Res = await request('/bookings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      eventId,
      seatIds: [s1Seat.seatId, s4Available1.seatId, s4Available2.seatId]
    })
  });
  console.log(`  HTTP Status: ${s4Res.status}`);
  console.log(`  Response:`, JSON.stringify(s4Res.body));
  assert(s4Res.status === 409, `Expected 409 but got ${s4Res.status}`);
  assert(s4Res.body.message === 'One or more selected seats are no longer available.', 'Mismatch in error message');

  // Direct SQL proof that s4Available1 and s4Available2 remained AVAILABLE and no booking rows were inserted
  const [s4DbSeats] = await pool.query(
    'SELECT seat_id, status FROM seats WHERE seat_id IN (?, ?)',
    [s4Available1.seatId, s4Available2.seatId]
  );
  for (const row of s4DbSeats) {
    assert(row.status === 'AVAILABLE', `Seat ${row.seat_id} should have remained AVAILABLE but was ${row.status}`);
  }
  const [s4DbBookings] = await pool.query(
    'SELECT COUNT(*) AS count FROM booking_seats WHERE seat_id IN (?, ?)',
    [s4Available1.seatId, s4Available2.seatId]
  );
  assert(s4DbBookings[0].count === 0, `Expected 0 booking_seats rows but found ${s4DbBookings[0].count}`);
  console.log('  [DB Check] Verified both seats remain AVAILABLE and 0 booking_seats rows created.');
  console.log('  \x1b[32m✔ Scenario 4 Passed\x1b[0m\n');

  // SCENARIO 5: 9 seats requested (400)
  console.log('--- Scenario 5: 9 seats requested (400) ---');
  const s5Seats = availableSeats.slice(6, 15).map((s) => s.seatId);
  assert(s5Seats.length === 9, 'Need 9 seats for scenario 5');
  const s5Res = await request('/bookings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      eventId,
      seatIds: s5Seats
    })
  });
  console.log(`  HTTP Status: ${s5Res.status}`);
  console.log(`  Response:`, JSON.stringify(s5Res.body));
  assert(s5Res.status === 400, `Expected 400 but got ${s5Res.status}`);
  console.log('  \x1b[32m✔ Scenario 5 Passed\x1b[0m\n');

  // SCENARIO 6: Duplicate seat IDs in request (400)
  console.log('--- Scenario 6: Duplicate seat IDs in request (400) ---');
  const s6Seat = availableSeats[6].seatId;
  const s6Res = await request('/bookings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      eventId,
      seatIds: [s6Seat, s6Seat]
    })
  });
  console.log(`  HTTP Status: ${s6Res.status}`);
  console.log(`  Response:`, JSON.stringify(s6Res.body));
  assert(s6Res.status === 400, `Expected 400 but got ${s6Res.status}`);
  console.log('  \x1b[32m✔ Scenario 6 Passed\x1b[0m\n');

  // SCENARIO 7: Seats from another event (404)
  console.log('--- Scenario 7: Seats from another event (404) ---');
  const [event1Seats] = await pool.query('SELECT seat_id FROM seats WHERE event_id = 1 LIMIT 1');
  const foreignSeatId = event1Seats[0].seat_id;
  const s7Res = await request('/bookings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      eventId: 2,
      seatIds: [foreignSeatId]
    })
  });
  console.log(`  HTTP Status: ${s7Res.status}`);
  console.log(`  Response:`, JSON.stringify(s7Res.body));
  assert(s7Res.status === 404, `Expected 404 but got ${s7Res.status}`);
  console.log('  \x1b[32m✔ Scenario 7 Passed\x1b[0m\n');

  // SCENARIO 8: Unauthenticated request without token (401)
  console.log('--- Scenario 8: Unauthenticated request without token (401) ---');
  const s8Res = await request('/bookings', {
    method: 'POST',
    body: JSON.stringify({
      eventId: 2,
      seatIds: [availableSeats[7].seatId]
    })
  });
  console.log(`  HTTP Status: ${s8Res.status}`);
  console.log(`  Response:`, JSON.stringify(s8Res.body));
  assert(s8Res.status === 401, `Expected 401 but got ${s8Res.status}`);
  console.log('  \x1b[32m✔ Scenario 8 Passed\x1b[0m\n');

  // SCENARIO 9: Same Idempotency-Key twice sequentially (200, 1 booking row)
  console.log('--- Scenario 9: Sequential replay of same Idempotency-Key (200) ---');
  const seqKey = `GATE8_SEQ_KEY_${Date.now()}`;
  const s9SeatId = availableSeats[8].seatId;

  // 1st request: creates booking (201)
  const s9Res1 = await request('/bookings', {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': seqKey },
    body: JSON.stringify({
      eventId: 2,
      seatIds: [s9SeatId]
    })
  });
  console.log(`  [Call 1] Status: ${s9Res1.status}, BookingReference: ${s9Res1.body?.data?.bookingReference}`);
  assert(s9Res1.status === 201, `Expected 201 on first call but got ${s9Res1.status}`);

  // 2nd request: idempotent replay (200)
  const s9Res2 = await request('/bookings', {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': seqKey },
    body: JSON.stringify({
      eventId: 2,
      seatIds: [s9SeatId]
    })
  });
  console.log(`  [Call 2] Status: ${s9Res2.status}, BookingReference: ${s9Res2.body?.data?.bookingReference}`);
  assert(s9Res2.status === 200, `Expected 200 on replay but got ${s9Res2.status}`);
  assert(s9Res2.body.data.bookingId === s9Res1.body.data.bookingId, 'Booking ID changed on replay');
  assert(s9Res2.body.data.bookingReference === s9Res1.body.data.bookingReference, 'Reference changed on replay');
  const expectedS9Total = Number(availableSeats[8].price);
  assert(s9Res1.body.data.totalAmount === expectedS9Total, `Total mismatch call 1: expected ${expectedS9Total}, got ${s9Res1.body.data.totalAmount}`);
  assert(s9Res2.body.data.totalAmount === expectedS9Total, `Total mismatch call 2: expected ${expectedS9Total}, got ${s9Res2.body.data.totalAmount}`);

  // Direct SQL count check: exactly 1 booking row
  const [s9Count] = await pool.query(
    'SELECT COUNT(*) AS count FROM bookings WHERE idempotency_key = ?',
    [seqKey]
  );
  console.log(`  [DB Check] Bookings rows for key ${seqKey}: ${s9Count[0].count}`);
  assert(s9Count[0].count === 1, `Expected exactly 1 booking row in DB, got ${s9Count[0].count}`);
  console.log('  \x1b[32m✔ Scenario 9 Passed\x1b[0m\n');

  // SCENARIO 10: Same Idempotency-Key with different payload/seats (409)
  console.log('--- Scenario 10: Same Idempotency-Key with different seats (409) ---');
  const s10DiffSeatId = availableSeats[9].seatId;
  const s10Res = await request('/bookings', {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': seqKey },
    body: JSON.stringify({
      eventId: 2,
      seatIds: [s10DiffSeatId]
    })
  });
  console.log(`  HTTP Status: ${s10Res.status}`);
  console.log(`  Response:`, JSON.stringify(s10Res.body));
  assert(s10Res.status === 409, `Expected 409 but got ${s10Res.status}`);
  assert(
    s10Res.body.message === 'Idempotency key already used for a different request',
    'Unexpected error message for payload mismatch'
  );
  console.log('  \x1b[32m✔ Scenario 10 Passed\x1b[0m\n');

  // SCENARIO 11: 5 simultaneous requests with the same Idempotency-Key via Promise.all
  console.log('--- Scenario 11: 5 simultaneous requests with same Idempotency-Key (Promise.all) ---');
  const concurKey = `GATE8_CONCUR_${Date.now()}`;
  const concurSeatsObj = [availableSeats[10], availableSeats[11]];
  const concurSeats = concurSeatsObj.map((s) => s.seatId);
  const expectedConcurTotal = concurSeatsObj.reduce((sum, s) => sum + Math.round(Number(s.price) * 100), 0) / 100;
  console.log(`  Idempotency-Key: ${concurKey}`);
  console.log(`  Target Seats: [${concurSeats.join(', ')}]`);

  const concurrentRequests = Array.from({ length: 5 }, (_, idx) =>
    request('/bookings', {
      method: 'POST',
      headers: { ...authHeaders, 'Idempotency-Key': concurKey },
      body: JSON.stringify({
        eventId: 2,
        seatIds: concurSeats
      })
    }).then((res) => ({ requestIndex: idx + 1, ...res }))
  );

  const concurResults = await Promise.all(concurrentRequests);

  console.log('  Concurrent Results:');
  const statusCounts = {};
  for (const r of concurResults) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    console.log(
      `    Request #${r.requestIndex}: HTTP ${r.status} | BookingRef: ${r.body?.data?.bookingReference || 'N/A'}`
    );
  }

  console.log(`  Status breakdown:`, JSON.stringify(statusCounts));

  // Assertions for Scenario 11
  assert(!statusCounts[500], `Received unexpected 500 error(s): ${statusCounts[500]}`);
  assert(statusCounts[201] === 1, `Expected exactly one 201 response, got ${statusCounts[201]}`);
  assert(statusCounts[200] === 4, `Expected exactly four 200 responses, got ${statusCounts[200]}`);

  // Direct SQL count check: exactly 1 booking row for concurKey
  const [concurDbRows] = await pool.query(
    'SELECT booking_id, booking_reference, total_amount FROM bookings WHERE idempotency_key = ?',
    [concurKey]
  );
  console.log(`  [DB Check] Number of booking rows for key ${concurKey}: ${concurDbRows.length}`);
  assert(concurDbRows.length === 1, `Expected exactly 1 booking row, got ${concurDbRows.length}`);
  assert(Number(concurDbRows[0].total_amount) === expectedConcurTotal, `Expected total_amount ${expectedConcurTotal}, got ${concurDbRows[0].total_amount}`);

  // Verify seat statuses in DB
  const [concurSeatRows] = await pool.query(
    'SELECT seat_id, status FROM seats WHERE seat_id IN (?, ?)',
    concurSeats
  );
  for (const row of concurSeatRows) {
    assert(row.status === 'BOOKED', `Seat ${row.seat_id} should be BOOKED but is ${row.status}`);
  }

  // Verify active booking_seats rows
  const [concurBsRows] = await pool.query(
    'SELECT COUNT(*) AS count FROM booking_seats WHERE booking_id = ? AND is_active = 1',
    [concurDbRows[0].booking_id]
  );
  assert(concurBsRows[0].count === 2, `Expected 2 active booking_seats rows, got ${concurBsRows[0].count}`);
  console.log(`  [DB Check] Both seats marked BOOKED, 2 active booking_seats rows tied to booking ${concurDbRows[0].booking_id}.`);
  console.log('  \x1b[32m✔ Scenario 11 Passed\x1b[0m\n');

  console.log('===============================================================');
  console.log('       \x1b[32mALL 11 GATE SCENARIOS PASSED WITH ZERO ERRORS!\x1b[0m          ');
  console.log('===============================================================\n');
}

runGate()
  .then(async () => {
    if (serverInstance) {
      serverInstance.close();
    }
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n\x1b[31m[GATE FAILED]\x1b[0m', err.message);
    if (serverInstance) {
      serverInstance.close();
    }
    try {
      await pool.end();
    } catch (_) {}
    process.exit(1);
  });
