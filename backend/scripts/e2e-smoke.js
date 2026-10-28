/**
 * backend/scripts/e2e-smoke.js
 * End-to-end smoke test over real HTTP.
 * 
 * Verifies the full user flow:
 * 1. Register -> POST /api/v1/auth/register
 * 2. Login -> POST /api/v1/auth/login
 * 3. Events -> GET /api/v1/events
 * 4. Event -> GET /api/v1/events/:id
 * 5. Seats -> GET /api/v1/events/:id/seats
 * 6. Book -> POST /api/v1/bookings
 * 7. My Bookings -> GET /api/v1/bookings/my
 * 8. Get Booking -> GET /api/v1/bookings/:id
 * 9. Cancel -> POST /api/v1/bookings/:id/cancel
 * 10. Rebook -> POST /api/v1/bookings (rebooking the released seat)
 *
 * Prints PASS/FAIL per step and exits non-zero on failure.
 */

const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const app = require('../src/app');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

let serverInstance = null;

async function ensureServerRunning() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (res.ok) {
      console.log(`[INFO] Server already active at ${BASE_URL}\n`);
      return;
    }
  } catch (_) {
    // Server not running, start locally
  }

  await new Promise((resolve, reject) => {
    serverInstance = app.listen(PORT, (err) => {
      if (err) return reject(err);
      console.log(`[INFO] Started HTTP server on http://localhost:${PORT}\n`);
      resolve();
    });
  });
}

function stopServerIfStarted() {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
}

async function api(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const { headers, ...rest } = options;
  const res = await fetch(url, {
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

function logPass(stepNum, description, details = '') {
  console.log(`\x1b[32m[PASS]\x1b[0m Step ${stepNum}: ${description}${details ? ` -> ${details}` : ''}`);
}

function logFail(stepNum, description, error) {
  console.error(`\x1b[31m[FAIL]\x1b[0m Step ${stepNum}: ${description}`);
  if (error) console.error(`       Error:`, error);
}

async function runE2ESmoke() {
  console.log('================================================================');
  console.log('E2E SMOKE TEST OVER REAL HTTP (TicketFlow)');
  console.log('================================================================\n');

  await ensureServerRunning();

  const timestamp = Date.now();
  const testEmail = `smoke_user_${timestamp}@example.com`;
  const testPassword = 'Password@123';
  const testName = 'Smoke Tester';

  let token = null;
  let targetEventId = null;
  let targetSeatId = null;
  let targetSeatNumber = null;
  let bookingId = null;
  let bookingReference = null;

  try {
    // -------------------------------------------------------------------------
    // Step 1: Register
    // -------------------------------------------------------------------------
    const regRes = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: testName,
        email: testEmail,
        password: testPassword
      })
    });

    if (regRes.status !== 201 || !regRes.body?.data?.token) {
      throw new Error(`Register failed (${regRes.status}): ${JSON.stringify(regRes.body)}`);
    }
    token = regRes.body.data.token;
    logPass(1, 'Register new user', testEmail);

    // -------------------------------------------------------------------------
    // Step 2: Login
    // -------------------------------------------------------------------------
    const loginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });

    if (loginRes.status !== 200 || !loginRes.body?.data?.token) {
      throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginRes.body)}`);
    }
    token = loginRes.body.data.token;
    logPass(2, 'Login with registered credentials', `Token length: ${token.length}`);

    // -------------------------------------------------------------------------
    // Step 3: Get Events List
    // -------------------------------------------------------------------------
    const eventsRes = await api('/events', { method: 'GET' });
    if (eventsRes.status !== 200 || !Array.isArray(eventsRes.body?.data?.events) || eventsRes.body.data.events.length === 0) {
      throw new Error(`Get events failed (${eventsRes.status}): ${JSON.stringify(eventsRes.body)}`);
    }
    const events = eventsRes.body.data.events;
    targetEventId = events[0].eventId;
    logPass(3, 'Fetch upcoming events list', `Found ${events.length} events, target ID: ${targetEventId}`);

    // -------------------------------------------------------------------------
    // Step 4: Get Event Details
    // -------------------------------------------------------------------------
    const eventRes = await api(`/events/${targetEventId}`, { method: 'GET' });
    if (eventRes.status !== 200 || !eventRes.body?.data?.event?.eventId) {
      throw new Error(`Get event details failed (${eventRes.status}): ${JSON.stringify(eventRes.body)}`);
    }
    const event = eventRes.body.data.event;
    logPass(4, 'Fetch event details', `Title: "${event.title}", Venue: "${event.venue}"`);

    // -------------------------------------------------------------------------
    // Step 5: Get Seats
    // -------------------------------------------------------------------------
    const seatsRes = await api(`/events/${targetEventId}/seats`, { method: 'GET' });
    if (seatsRes.status !== 200 || !Array.isArray(seatsRes.body?.data?.seats)) {
      throw new Error(`Get seats failed (${seatsRes.status}): ${JSON.stringify(seatsRes.body)}`);
    }
    const availableSeats = seatsRes.body.data.seats.filter((s) => s.status === 'AVAILABLE');
    if (availableSeats.length === 0) {
      throw new Error(`No available seats found for event ${targetEventId}`);
    }
    targetSeatId = availableSeats[0].seatId;
    targetSeatNumber = availableSeats[0].seatNumber;
    logPass(5, 'Fetch event seats', `Found ${availableSeats.length} available seats, picking ${targetSeatNumber} (ID: ${targetSeatId})`);

    // -------------------------------------------------------------------------
    // Step 6: Book the Seat
    // -------------------------------------------------------------------------
    const idempotencyKey1 = crypto.randomUUID();
    const bookRes = await api('/bookings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey1
      },
      body: JSON.stringify({
        eventId: targetEventId,
        seatIds: [targetSeatId]
      })
    });

    if (bookRes.status !== 201 || !bookRes.body?.data?.bookingId) {
      throw new Error(`Booking failed (${bookRes.status}): ${JSON.stringify(bookRes.body)}`);
    }
    const booking = bookRes.body.data;
    bookingId = booking.bookingId;
    bookingReference = booking.bookingReference;
    if (booking.totalAmount !== availableSeats[0].price) {
      throw new Error(`Booking totalAmount ${booking.totalAmount} did not match seat price ${availableSeats[0].price}`);
    }
    logPass(6, 'Create booking with atomic row lock', `Ref: ${bookingReference}, Total: Rs ${booking.totalAmount}`);

    // -------------------------------------------------------------------------
    // Step 7: Get My Bookings
    // -------------------------------------------------------------------------
    const myBookingsRes = await api('/bookings/my', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (myBookingsRes.status !== 200 || !Array.isArray(myBookingsRes.body?.data?.bookings)) {
      throw new Error(`Get my bookings failed (${myBookingsRes.status}): ${JSON.stringify(myBookingsRes.body)}`);
    }
    const myBookings = myBookingsRes.body.data.bookings;
    const foundBooking = myBookings.find((b) => b.bookingId === bookingId);
    if (!foundBooking) {
      throw new Error(`Created booking ID ${bookingId} not found in user's bookings list`);
    }
    logPass(7, 'Fetch my bookings', `Found ${myBookings.length} booking(s), confirmed ${bookingReference} present`);

    // -------------------------------------------------------------------------
    // Step 8: Get Booking By ID
    // -------------------------------------------------------------------------
    const getBookingRes = await api(`/bookings/${bookingId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (getBookingRes.status !== 200 || getBookingRes.body?.data?.booking?.bookingReference !== bookingReference) {
      throw new Error(`Get booking by ID failed (${getBookingRes.status}): ${JSON.stringify(getBookingRes.body)}`);
    }
    logPass(8, 'Get booking by ID', `Verified status: ${getBookingRes.body.data.booking.status}`);

    // -------------------------------------------------------------------------
    // Step 9: Cancel Booking
    // -------------------------------------------------------------------------
    const cancelRes = await api(`/bookings/${bookingId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (cancelRes.status !== 200 || cancelRes.body?.data?.status !== 'CANCELLED') {
      throw new Error(`Cancel booking failed (${cancelRes.status}): ${JSON.stringify(cancelRes.body)}`);
    }
    logPass(9, 'Cancel booking and release seats', `Booking ${bookingReference} marked CANCELLED`);

    // Verify seat is now AVAILABLE again
    const postCancelSeatsRes = await api(`/events/${targetEventId}/seats`, { method: 'GET' });
    const releasedSeat = postCancelSeatsRes.body.data.seats.find((s) => s.seatId === targetSeatId);
    if (!releasedSeat || releasedSeat.status !== 'AVAILABLE') {
      throw new Error(`Seat ${targetSeatNumber} was not released back to AVAILABLE! Status: ${releasedSeat?.status}`);
    }

    // -------------------------------------------------------------------------
    // Step 10: Rebook the Released Seat
    // -------------------------------------------------------------------------
    const idempotencyKey2 = crypto.randomUUID();
    const rebookRes = await api('/bookings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey2
      },
      body: JSON.stringify({
        eventId: targetEventId,
        seatIds: [targetSeatId]
      })
    });

    if (rebookRes.status !== 201 || !rebookRes.body?.data?.bookingId) {
      throw new Error(`Rebook failed (${rebookRes.status}): ${JSON.stringify(rebookRes.body)}`);
    }
    const rebooking = rebookRes.body.data;
    logPass(10, 'Rebook the released seat', `New Ref: ${rebooking.bookingReference}, New Booking ID: ${rebooking.bookingId}`);

    console.log('\n================================================================');
    console.log('\x1b[32m[SUCCESS] ALL 10 E2E SMOKE TEST STEPS PASSED SUCCESSFULLY!\x1b[0m');
    console.log('================================================================\n');

    stopServerIfStarted();
    process.exit(0);
  } catch (err) {
    logFail('ERROR', 'E2E smoke test pipeline failed', err.message);
    stopServerIfStarted();
    process.exit(1);
  }
}

runE2ESmoke();
