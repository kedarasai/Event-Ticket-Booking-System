/**
 * scripts/race.js
 * High-concurrency Race & Cancellation GATE runner.
 * 
 * Verifies:
 * 1. 10 simultaneous booking attempts by 10 distinct users for the SAME seat.
 *    (Zero double-booking: exactly 1x 201, 9x 409, 0x 500)
 * 2. Database state inspection showing single owner and locked seat.
 * 3. Cancellation of the booking: seat becomes AVAILABLE, booking_seats is_active = false.
 * 4. Successful rebooking of the same seat by a different user (201).
 * 5. Authorization (403): non-owner cannot view or cancel the booking (admin can view).
 * 6. Non-existent booking (404) for both GET and CANCEL.
 * 7. Double-cancellation (409 "Booking already cancelled").
 * 8. GET /bookings/my and GET /bookings/:id contract shapes.
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
  } catch (_) {}

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

async function authenticateUser(email, password, name = 'Race User') {
  // Register if needed
  await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password })
  });

  // Login
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  assert(loginRes.status === 200, `Failed to authenticate ${email}: HTTP ${loginRes.status}`);
  return {
    token: loginRes.body.data.token,
    user: loginRes.body.data.user
  };
}

async function runRace() {
  console.log('\n===============================================================');
  console.log('       RACE & CANCELLATION GATE: CONCURRENCY & ZERO DOUBLE-BOOKING');
  console.log('===============================================================\n');

  await ensureServerRunning();

  // STEP 1: Authenticate 10 distinct users + Admin
  console.log('[STEP 1] Authenticating 10 distinct users + Admin...');
  const users = [];
  const password = 'RaceUser@1234';

  for (let i = 1; i <= 10; i++) {
    const email = `race_user_${i}@example.com`;
    const authData = await authenticateUser(email, password, `Race User ${i}`);
    users.push(authData);
  }
  console.log(`  -> Successfully authenticated 10 race users.`);

  const adminAuth = await authenticateUser('admin@example.com', 'Admin@1234');
  console.log(`  -> Admin user authenticated.\n`);

  // STEP 2: Pick an event and find 1 AVAILABLE seat that is NOT in the first section
  console.log('[STEP 2] Selecting target event and available seat from a non-first section...');
  const eventId = 1; // Neon Odyssey: Synthwave World Tour (ARENA)
  const seatsRes = await request(`/events/${eventId}/seats`);
  assert(seatsRes.status === 200, `Failed to get seats for event ${eventId}`);
  
  const firstSection = seatsRes.body.data.seats[0]?.section;
  const nonFirstSectionSeats = seatsRes.body.data.seats.filter(
    (s) => s.status === 'AVAILABLE' && s.section !== firstSection
  );
  assert(nonFirstSectionSeats.length > 0, `No available seats found in non-first section for event ${eventId}`);

  const targetSeat = nonFirstSectionSeats[0];
  console.log(`  Target Event: ${eventId}`);
  console.log(`  Target Section: ${targetSeat.section} (First section is: ${firstSection})`);
  console.log(`  Target Seat:  ID ${targetSeat.seatId} (${targetSeat.seatNumber})\n`);

  // STEP 3: Fire 10 SIMULTANEOUS POST /bookings for the SAME seat via Promise.all
  console.log('[STEP 3] Firing 10 SIMULTANEOUS booking requests for seat ' + targetSeat.seatNumber + '...');
  const racePromises = users.map((u, index) =>
    request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${u.token}` },
      body: JSON.stringify({
        eventId,
        seatIds: [targetSeat.seatId]
      })
    }).then((res) => ({ userIndex: index + 1, email: u.user.email, ...res }))
  );

  const raceResults = await Promise.all(racePromises);

  console.log('\n--- 10-Way Simultaneous Race Results ---');
  let winner = null;
  const statusCounts = {};

  for (const r of raceResults) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    if (r.status === 201) {
      winner = r;
      console.log(`  \x1b[32m[WINNER]\x1b[0m User #${r.userIndex} (${r.email}): HTTP 201 | Ref: ${r.body?.data?.bookingReference}`);
    } else {
      console.log(`  [DENIED] User #${r.userIndex} (${r.email}): HTTP ${r.status} | ${r.body?.message}`);
    }
  }

  console.log('\nStatus Breakdown:', JSON.stringify(statusCounts));
  assert(statusCounts[201] === 1, `Expected exactly ONE 201 response, got ${statusCounts[201]}`);
  assert(statusCounts[409] === 9, `Expected exactly NINE 409 responses, got ${statusCounts[409]}`);
  assert(!statusCounts[500], `Unexpected 500 error in race: ${statusCounts[500]}`);
  assert(winner !== null, 'No winner found');
  console.log('  \x1b[32m✔ 10-Way Race Concurrency Check Passed (Exactly 1x 201, 9x 409, 0x 500)\x1b[0m\n');

  const winningBookingId = winner.body.data.bookingId;
  const winningUserIndex = winner.userIndex - 1;
  const winningToken = users[winningUserIndex].token;

  // STEP 4: DB State check after race
  console.log('[STEP 4] Verifying database state after race...');
  const [dbSeat] = await pool.query(
    'SELECT seat_id, seat_number, status FROM seats WHERE seat_id = ?',
    [targetSeat.seatId]
  );
  assert(dbSeat[0].status === 'BOOKED', `Seat should be BOOKED in DB, but was ${dbSeat[0].status}`);

  const [dbBookingSeats] = await pool.query(
    'SELECT COUNT(*) AS count FROM booking_seats WHERE seat_id = ? AND is_active = 1',
    [targetSeat.seatId]
  );
  assert(dbBookingSeats[0].count === 1, `Expected 1 active booking_seats row, found ${dbBookingSeats[0].count}`);
  console.log(`  [DB Check] Seat ${targetSeat.seatNumber} is BOOKED with exactly 1 active booking_seats row.`);
  console.log('  \x1b[32m✔ Post-Race DB State Verified\x1b[0m\n');

  // STEP 5: Cancel the winning booking
  console.log(`[STEP 5] Cancelling winning booking (ID: ${winningBookingId}) by User #${winner.userIndex}...`);
  const cancelRes = await request(`/bookings/${winningBookingId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${winningToken}` }
  });
  console.log(`  HTTP Status: ${cancelRes.status}`);
  console.log(`  Response:`, JSON.stringify(cancelRes.body));
  assert(cancelRes.status === 200, `Expected 200 on cancel, got ${cancelRes.status}`);
  assert(cancelRes.body.data.bookingId === winningBookingId, 'Booking ID mismatch on cancel');
  assert(cancelRes.body.data.status === 'CANCELLED', 'Expected status CANCELLED');
  console.log('  \x1b[32m✔ Cancellation Succeeded\x1b[0m\n');

  // STEP 6: DB state check after cancellation
  console.log('[STEP 6] Verifying DB state after cancellation...');
  const [dbSeatAfterCancel] = await pool.query(
    'SELECT seat_id, status FROM seats WHERE seat_id = ?',
    [targetSeat.seatId]
  );
  assert(
    dbSeatAfterCancel[0].status === 'AVAILABLE',
    `Seat should be AVAILABLE after cancel, but was ${dbSeatAfterCancel[0].status}`
  );

  const [dbBsAfterCancel] = await pool.query(
    'SELECT is_active FROM booking_seats WHERE booking_id = ?',
    [winningBookingId]
  );
  assert(
    Number(dbBsAfterCancel[0].is_active) === 0,
    `booking_seats is_active should be 0, but was ${dbBsAfterCancel[0].is_active}`
  );

  const [dbBookingAfterCancel] = await pool.query(
    'SELECT status, cancelled_at FROM bookings WHERE booking_id = ?',
    [winningBookingId]
  );
  assert(
    dbBookingAfterCancel[0].status === 'CANCELLED' && dbBookingAfterCancel[0].cancelled_at !== null,
    'Booking record status should be CANCELLED with cancelled_at set'
  );
  console.log(`  [DB Check] Seat ${targetSeat.seatNumber} is AVAILABLE.`);
  console.log(`  [DB Check] booking_seats is_active = 0 (inactive).`);
  console.log(`  [DB Check] booking status = CANCELLED, cancelled_at = ${dbBookingAfterCancel[0].cancelled_at.toISOString()}`);
  console.log('  \x1b[32m✔ Post-Cancel DB State Verified\x1b[0m\n');

  // STEP 7: Re-book the same seat successfully
  console.log('[STEP 7] Re-booking the SAME seat by a different user...');
  const rebookUserIndex = (winningUserIndex + 1) % users.length;
  const rebookUser = users[rebookUserIndex];
  const rebookRes = await request('/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${rebookUser.token}` },
    body: JSON.stringify({
      eventId,
      seatIds: [targetSeat.seatId]
    })
  });
  console.log(`  HTTP Status: ${rebookRes.status}`);
  console.log(`  Response:`, JSON.stringify(rebookRes.body));
  assert(rebookRes.status === 201, `Expected 201 on rebooking, got ${rebookRes.status}`);
  const rebookedId = rebookRes.body.data.bookingId;
  assert(rebookedId !== winningBookingId, 'Rebooked booking ID should be new');
  assert(rebookRes.body.data.totalAmount === targetSeat.price, `Expected totalAmount ${targetSeat.price}, got ${rebookRes.body.data.totalAmount}`);
  assert(Array.isArray(rebookRes.body.data.seats) && rebookRes.body.data.seats[0].price === targetSeat.price, 'Seats array price mismatch');
  console.log(`  -> Seat successfully re-booked as booking #${rebookedId} by ${rebookUser.user.email}.`);
  console.log('  \x1b[32m✔ Rebooking Succeeded\x1b[0m\n');

  // STEP 8: Authorization checks (403)
  console.log('[STEP 8] Testing authorization (403 for non-owner, 200 for admin)...');
  const otherUserIndex = (rebookUserIndex + 1) % users.length;
  const otherUser = users[otherUserIndex];

  // Non-owner attempts to fetch booking
  const forbiddenGetRes = await request(`/bookings/${rebookedId}`, {
    headers: { Authorization: `Bearer ${otherUser.token}` }
  });
  console.log(`  Non-owner GET /bookings/${rebookedId}: HTTP ${forbiddenGetRes.status}`);
  assert(forbiddenGetRes.status === 403, `Expected 403 but got ${forbiddenGetRes.status}`);

  // Non-owner attempts to cancel booking
  const forbiddenCancelRes = await request(`/bookings/${rebookedId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${otherUser.token}` }
  });
  console.log(`  Non-owner POST /bookings/${rebookedId}/cancel: HTTP ${forbiddenCancelRes.status}`);
  assert(forbiddenCancelRes.status === 403, `Expected 403 but got ${forbiddenCancelRes.status}`);

  // Owner fetches booking (200)
  const ownerGetRes = await request(`/bookings/${rebookedId}`, {
    headers: { Authorization: `Bearer ${rebookUser.token}` }
  });
  console.log(`  Owner GET /bookings/${rebookedId}: HTTP ${ownerGetRes.status}`);
  assert(ownerGetRes.status === 200, `Expected 200 for owner, got ${ownerGetRes.status}`);
  assert(ownerGetRes.body.data.booking.bookingId === rebookedId, 'Booking ID mismatch');
  assert(ownerGetRes.body.data.booking.event.eventId === eventId, 'Event ID mismatch in booking summary');
  assert(Array.isArray(ownerGetRes.body.data.booking.seatNumbers), 'seatNumbers should be array');

  // Admin fetches booking (200)
  const adminGetRes = await request(`/bookings/${rebookedId}`, {
    headers: { Authorization: `Bearer ${adminAuth.token}` }
  });
  console.log(`  Admin GET /bookings/${rebookedId}: HTTP ${adminGetRes.status}`);
  assert(adminGetRes.status === 200, `Expected 200 for admin, got ${adminGetRes.status}`);
  console.log('  \x1b[32m✔ Authorization Checks Passed (403 for non-owners, 200 for owner & admin)\x1b[0m\n');

  // STEP 9: 404 Checks
  console.log('[STEP 9] Testing non-existent booking ID (404)...');
  const missingGetRes = await request('/bookings/999999', {
    headers: { Authorization: `Bearer ${rebookUser.token}` }
  });
  console.log(`  GET /bookings/999999: HTTP ${missingGetRes.status}`);
  assert(missingGetRes.status === 404, `Expected 404 but got ${missingGetRes.status}`);

  const missingCancelRes = await request('/bookings/999999/cancel', {
    method: 'POST',
    headers: { Authorization: `Bearer ${rebookUser.token}` }
  });
  console.log(`  POST /bookings/999999/cancel: HTTP ${missingCancelRes.status}`);
  assert(missingCancelRes.status === 404, `Expected 404 but got ${missingCancelRes.status}`);
  console.log('  \x1b[32m✔ 404 Checks Passed\x1b[0m\n');

  // STEP 10: Double cancellation (409)
  console.log('[STEP 10] Testing double cancellation (409)...');
  // First cancel by owner (200)
  const cancel1Res = await request(`/bookings/${rebookedId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${rebookUser.token}` }
  });
  console.log(`  First cancel: HTTP ${cancel1Res.status}`);
  assert(cancel1Res.status === 200, `Expected 200 on first cancel, got ${cancel1Res.status}`);

  // Second cancel by owner (409)
  const cancel2Res = await request(`/bookings/${rebookedId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${rebookUser.token}` }
  });
  console.log(`  Second cancel: HTTP ${cancel2Res.status} | Response:`, JSON.stringify(cancel2Res.body));
  assert(cancel2Res.status === 409, `Expected 409 on second cancel, got ${cancel2Res.status}`);
  assert(
    cancel2Res.body.message === 'Booking already cancelled',
    `Expected "Booking already cancelled", got "${cancel2Res.body.message}"`
  );
  console.log('  \x1b[32m✔ Double Cancellation 409 Check Passed\x1b[0m\n');

  // STEP 11: GET /bookings/my Verification
  console.log('[STEP 11] Verifying GET /bookings/my contract shape...');
  const myBookingsRes = await request('/bookings/my', {
    headers: { Authorization: `Bearer ${rebookUser.token}` }
  });
  console.log(`  HTTP Status: ${myBookingsRes.status}`);
  assert(myBookingsRes.status === 200, `Expected 200, got ${myBookingsRes.status}`);
  assert(Array.isArray(myBookingsRes.body.data.bookings), 'Expected data.bookings array');
  const myBooking = myBookingsRes.body.data.bookings[0];
  console.log('  Sample booking item:', JSON.stringify(myBooking));
  assert(myBooking.bookingId === rebookedId, 'Newest booking should be first');
  assert(myBooking.status === 'CANCELLED', 'Status should reflect CANCELLED');
  assert(typeof myBooking.totalAmount === 'number', 'totalAmount should be Number');
  assert(typeof myBooking.createdAt === 'string', 'createdAt should be ISO string');
  assert(myBooking.event && typeof myBooking.event.title === 'string', 'event summary missing');
  assert(Array.isArray(myBooking.seatNumbers), 'seatNumbers should be array');
  assert(Array.isArray(myBooking.seats), 'seats should be array');
  assert(myBooking.seats.length > 0, 'seats array should not be empty');
  assert(typeof myBooking.seats[0].price === 'number', 'seat price should be Number');
  assert(typeof myBooking.seats[0].tier === 'string', 'seat tier should be string');
  console.log('  \x1b[32m✔ GET /bookings/my Contract Shape Passed\x1b[0m\n');

  console.log('===============================================================');
  console.log('  \x1b[32mALL RACE, CANCELLATION, REBOOK & SECURITY CHECKS PASSED!\x1b[0m     ');
  console.log('===============================================================\n');
}

runRace()
  .then(async () => {
    if (serverInstance) serverInstance.close();
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n\x1b[31m[RACE GATE FAILED]\x1b[0m', err.message);
    if (serverInstance) serverInstance.close();
    try {
      await pool.end();
    } catch (_) {}
    process.exit(1);
  });
