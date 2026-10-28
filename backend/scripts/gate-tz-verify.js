const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { pool } = require('../src/config/database');

const BASE_URL = `http://localhost:${process.env.PORT || 5000}/api/v1`;

async function verifyTimezoneGate() {
  console.log('================================================================');
  console.log('GATE: TIME ZONE & TIMESTAMP INVARIANT VERIFICATION');
  console.log('================================================================\n');

  // STEP 1: Query timezone and timestamps through the app's pool
  console.log('[STEP 1] Querying @@session.time_zone, NOW(), UTC_TIMESTAMP() through app pool:');
  const [tzRows] = await pool.query(
    'SELECT @@session.time_zone AS session_time_zone, NOW() AS session_now, UTC_TIMESTAMP() AS utc_ts'
  );
  const row = tzRows[0];
  console.log('  @@session.time_zone:', row.session_time_zone);
  console.log('  NOW():              ', row.session_now);
  console.log('  UTC_TIMESTAMP():    ', row.utc_ts);

  const nowMs = new Date(row.session_now).getTime();
  const utcMs = new Date(row.utc_ts).getTime();
  const diffSec = Math.abs(nowMs - utcMs) / 1000;
  console.log(`  Difference between NOW() and UTC_TIMESTAMP(): ${diffSec}s`);

  if (row.session_time_zone !== '+00:00') {
    throw new Error(`Expected @@session.time_zone to be '+00:00', but got '${row.session_time_zone}'`);
  }
  if (diffSec > 1) {
    throw new Error(`Expected NOW() and UTC_TIMESTAMP() to be equal, difference was ${diffSec}s`);
  }
  console.log('  ✔ [PASS] Session time_zone is +00:00 and NOW() equals UTC_TIMESTAMP()!\n');

  // STEP 2: Live booking & cancellation verification
  console.log('[STEP 2] Making a booking, cancelling it, and checking createdAt vs cancelled_at:');
  // Login as demo user
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@example.com', password: 'Demo@1234' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data.token;

  // Find an available seat
  const seatsRes = await fetch(`${BASE_URL}/events/1/seats`);
  const seatsData = await seatsRes.json();
  const availSeat = seatsData.data.seats.find((s) => s.status === 'AVAILABLE');
  console.log(`  Found available seat: ${availSeat.seatNumber} (ID: ${availSeat.seatId})`);

  // Book seat
  const sysUtcBefore = new Date().toISOString();
  const bookRes = await fetch(`${BASE_URL}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ eventId: 1, seatIds: [availSeat.seatId] })
  });
  const bookData = await bookRes.json();
  const bookingId = bookData.data.bookingId;
  console.log(`  Booking created: ID ${bookingId}, Ref ${bookData.data.bookingReference}`);

  // Short pause before cancelling
  await new Promise((r) => setTimeout(r, 1100));

  // Cancel booking
  const cancelRes = await fetch(`${BASE_URL}/bookings/${bookingId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const cancelData = await cancelRes.json();
  console.log(`  Booking cancelled: status ${cancelData.data.status}`);
  const sysUtcAfter = new Date().toISOString();

  // Query database directly for raw created_at and cancelled_at
  const [bRows] = await pool.query(
    'SELECT booking_id, status, created_at, cancelled_at FROM bookings WHERE booking_id = ?',
    [bookingId]
  );
  const bookingRow = bRows[0];
  const dbCreatedIso = new Date(bookingRow.created_at).toISOString();
  const dbCancelledIso = new Date(bookingRow.cancelled_at).toISOString();

  console.log('\n--- Timestamp Inspection ---');
  console.log('  System UTC Before Booking: ', sysUtcBefore);
  console.log('  DB bookings.created_at:    ', dbCreatedIso);
  console.log('  DB bookings.cancelled_at:  ', dbCancelledIso);
  console.log('  System UTC After Cancel:   ', sysUtcAfter);

  const createdTime = new Date(dbCreatedIso).getTime();
  const cancelledTime = new Date(dbCancelledIso).getTime();
  const sysBeforeTime = new Date(sysUtcBefore).getTime();
  const sysAfterTime = new Date(sysUtcAfter).getTime();

  console.log('\n--- Assertion Checks ---');
  const isCreatedAfterSysBefore = createdTime >= sysBeforeTime - 2000;
  const isCancelledAfterCreated = cancelledTime >= createdTime;
  const isCancelledBeforeSysAfter = cancelledTime <= sysAfterTime + 2000;

  console.log('  1. created_at matches real current UTC time: ', isCreatedAfterSysBefore ? '✔ PASS' : '✗ FAIL');
  console.log('  2. created_at <= cancelled_at:               ', isCancelledAfterCreated ? '✔ PASS' : '✗ FAIL');
  console.log('  3. cancelled_at matches real current UTC time:', isCancelledBeforeSysAfter ? '✔ PASS' : '✗ FAIL');

  if (!isCreatedAfterSysBefore || !isCancelledAfterCreated || !isCancelledBeforeSysAfter) {
    throw new Error('Timestamp invariant assertion failed!');
  }

  console.log('\n================================================================');
  console.log('GATE: TIME ZONE & TIMESTAMP VERIFICATION ALL PASSED!');
  console.log('================================================================');
}

verifyTimezoneGate()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Gate check failed:', err);
    pool.end().finally(() => process.exit(1));
  });
