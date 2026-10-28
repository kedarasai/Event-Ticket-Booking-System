const request = require('supertest');
const app = require('../src/app');
const { pool, getConnection } = require('../src/config/database');
const db = require('../src/config/database');

describe('Bookings Integration Tests (Requirements 3, 4, 5, 6, 8, 9, 10)', () => {
  let tokenA = '';
  let tokenB = '';
  let adminToken = '';
  let event1Seats = [];
  let event2Seats = [];

  beforeAll(async () => {
    // Authenticate userA, userB, and admin
    const resA = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'userA@example.com', password: 'UserA@1234' });
    tokenA = resA.body.data.token;

    const resB = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'userB@example.com', password: 'UserB@1234' });
    tokenB = resB.body.data.token;

    const resAdmin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin@1234' });
    adminToken = resAdmin.body.data.token;

    // Fetch seats for Event 1 (price: 1500) and Event 2 (price: 2500)
    const seatsRes1 = await request(app).get('/api/v1/events/1/seats');
    event1Seats = seatsRes1.body.data.seats;

    const seatsRes2 = await request(app).get('/api/v1/events/2/seats');
    event2Seats = seatsRes2.body.data.seats;
  });

  // --- REQUIREMENT 3: Booking Success ---
  describe('3. Booking Success', () => {
    it('single-seat booking: should compute total correctly, mark seat BOOKED, and return 201', async () => {
      const seat = event1Seats[0];
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          eventId: 1,
          seatIds: [seat.seatId]
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bookingId).toBeDefined();
      expect(res.body.data.bookingReference).toMatch(/^EVT-[A-F0-9]{8}$/);
      expect(res.body.data.status).toBe('CONFIRMED');
      expect(res.body.data.eventId).toBe(1);
      expect(res.body.data.seatIds).toEqual([seat.seatId]);
      expect(res.body.data.seatNumbers).toEqual([seat.seatNumber]);
      expect(res.body.data.seats).toEqual([
        {
          seatId: seat.seatId,
          seatNumber: seat.seatNumber,
          section: 'Floor',
          tier: 'VIP',
          price: 3000
        }
      ]);
      expect(res.body.data.totalAmount).toBe(3000); // Floor VIP: 3000 * 1

      // Verify seat status in DB
      const [rows] = await pool.query('SELECT status FROM seats WHERE seat_id = ?', [seat.seatId]);
      expect(rows[0].status).toBe('BOOKED');
    });

    it('multi-seat booking: should compute total correctly for 3 seats, mark all BOOKED, and return 201', async () => {
      const seats = [event1Seats[1], event1Seats[2], event1Seats[3]];
      const seatIds = seats.map((s) => s.seatId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          eventId: 1,
          seatIds
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalAmount).toBe(9000); // Floor VIP: 3000 * 3
      expect(res.body.data.seatIds).toEqual(seatIds.sort((a, b) => a - b));
      expect(res.body.data.seats.length).toBe(3);
      for (const s of res.body.data.seats) {
        expect(s.section).toBe('Floor');
        expect(s.tier).toBe('VIP');
        expect(s.price).toBe(3000);
      }

      // Verify all 3 seats are BOOKED in DB
      const [rows] = await pool.query('SELECT status FROM seats WHERE seat_id IN (?, ?, ?)', seatIds);
      expect(rows.length).toBe(3);
      for (const r of rows) {
        expect(r.status).toBe('BOOKED');
      }
    });
  });

  // --- REQUIREMENT 4: Partial Failure ---
  describe('4. Partial Failure', () => {
    it('one taken seat among available seats: returns 409, no booking created, and available seats stay AVAILABLE', async () => {
      const takenSeatId = event1Seats[0].seatId; // Already booked above
      const availSeat1 = event1Seats[4].seatId;
      const availSeat2 = event1Seats[5].seatId;

      const [countBefore] = await pool.query('SELECT COUNT(*) AS count FROM bookings');

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          eventId: 1,
          seatIds: [takenSeatId, availSeat1, availSeat2]
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('One or more selected seats are no longer available.');

      // SQL Proof: No booking rows created
      const [countAfter] = await pool.query('SELECT COUNT(*) AS count FROM bookings');
      expect(countAfter[0].count).toBe(countBefore[0].count);

      // SQL Proof: No booking_seats rows created for availSeat1 or availSeat2
      const [bsRows] = await pool.query(
        'SELECT COUNT(*) AS count FROM booking_seats WHERE seat_id IN (?, ?)',
        [availSeat1, availSeat2]
      );
      expect(bsRows[0].count).toBe(0);

      // SQL Proof: Remaining seats are STILL AVAILABLE
      const [seatRows] = await pool.query(
        'SELECT status FROM seats WHERE seat_id IN (?, ?)',
        [availSeat1, availSeat2]
      );
      for (const r of seatRows) {
        expect(r.status).toBe('AVAILABLE');
      }
    });
  });

  // --- REQUIREMENT 5: Invalid Input ---
  describe('5. Invalid Input Validation', () => {
    it('empty array: should return 400', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ eventId: 1, seatIds: [] });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('seatIds must be an array with 1 to 8 seats');
    });

    it('duplicate seat IDs in array: should return 400', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ eventId: 1, seatIds: [event1Seats[6].seatId, event1Seats[6].seatId] });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Duplicate seat IDs are not allowed in a single booking request');
    });

    it('more than 8 seats: should return 400', async () => {
      const nineSeats = event1Seats.slice(6, 15).map((s) => s.seatId);
      expect(nineSeats.length).toBe(9);

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ eventId: 1, seatIds: nineSeats });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('seatIds must be an array with 1 to 8 seats');
    });

    it('seats from another event: should return 404', async () => {
      const foreignSeatId = event2Seats[0].seatId;
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ eventId: 1, seatIds: [foreignSeatId] });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('One or more selected seats do not exist for this event');
    });

    it('non-integer seatIds or eventId: should return 400', async () => {
      const res1 = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ eventId: 'invalid', seatIds: [event1Seats[6].seatId] });

      expect(res1.statusCode).toBe(400);

      const res2 = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ eventId: 1, seatIds: ['abc'] });

      expect(res2.statusCode).toBe(400);
    });
  });

  // --- REQUIREMENT 6: Authorization ---
  describe('6. Authorization', () => {
    let bookingAId = null;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ eventId: 1, seatIds: [event1Seats[6].seatId] });
      bookingAId = res.body.data.bookingId;
    });

    it('user B gets 403 when reading user A booking', async () => {
      const res = await request(app)
        .get(`/api/v1/bookings/${bookingAId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Access forbidden');
    });

    it('user B gets 403 when cancelling user A booking', async () => {
      const res = await request(app)
        .post(`/api/v1/bookings/${bookingAId}/cancel`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Access forbidden');
    });

    it('request without token gets 401', async () => {
      const resGet = await request(app).get(`/api/v1/bookings/${bookingAId}`);
      expect(resGet.statusCode).toBe(401);

      const resCancel = await request(app).post(`/api/v1/bookings/${bookingAId}/cancel`);
      expect(resCancel.statusCode).toBe(401);
    });

    it('admin gets 200 reading user A booking', async () => {
      const res = await request(app)
        .get(`/api/v1/bookings/${bookingAId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.booking.bookingId).toBe(bookingAId);
    });
  });

  // --- REQUIREMENT 8: Cancel & Rebook ---
  describe('8. Cancel and Rebook', () => {
    let bookingId = null;
    let targetSeatId = null;

    beforeAll(async () => {
      targetSeatId = event1Seats[7].seatId;
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ eventId: 1, seatIds: [targetSeatId] });
      bookingId = res.body.data.bookingId;
    });

    it('cancel: seat becomes AVAILABLE, booking CANCELLED, allocation inactive', async () => {
      const res = await request(app)
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bookingId).toBe(bookingId);
      expect(res.body.data.status).toBe('CANCELLED');

      // Verify in DB
      const [seatRows] = await pool.query('SELECT status FROM seats WHERE seat_id = ?', [targetSeatId]);
      expect(seatRows[0].status).toBe('AVAILABLE');

      const [bsRows] = await pool.query(
        'SELECT is_active FROM booking_seats WHERE booking_id = ?',
        [bookingId]
      );
      expect(Number(bsRows[0].is_active)).toBe(0);

      const [bRows] = await pool.query('SELECT status, cancelled_at FROM bookings WHERE booking_id = ?', [bookingId]);
      expect(bRows[0].status).toBe('CANCELLED');
      expect(bRows[0].cancelled_at).not.toBeNull();
    });

    it('rebook: successfully books the previously cancelled seat', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ eventId: 1, seatIds: [targetSeatId] });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.status).toBe('CONFIRMED');
      expect(res.body.data.bookingId).not.toBe(bookingId);

      const [seatRows] = await pool.query('SELECT status FROM seats WHERE seat_id = ?', [targetSeatId]);
      expect(seatRows[0].status).toBe('BOOKED');
    });

    it('double cancel: cancelling an already cancelled booking returns 409', async () => {
      const res = await request(app)
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Booking already cancelled');
    });
  });

  // --- REQUIREMENT 9: Idempotency ---
  describe('9. Idempotency Key Handling', () => {
    const seqKey = `IDEM_TEST_SEQ_${Date.now()}`;
    let seatA = null;
    let seatB = null;
    let originalBooking = null;

    beforeAll(() => {
      seatA = event1Seats[8].seatId;
      seatB = event1Seats[9].seatId;
    });

    it('sequential replay of same key returns 200 with original booking', async () => {
      // First call -> 201
      const res1 = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Idempotency-Key', seqKey)
        .send({ eventId: 1, seatIds: [seatA] });

      expect(res1.statusCode).toBe(201);
      originalBooking = res1.body.data;

      // Second call (same payload, same key) -> 200
      const res2 = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Idempotency-Key', seqKey)
        .send({ eventId: 1, seatIds: [seatA] });

      expect(res2.statusCode).toBe(200);
      expect(res2.body.data.bookingId).toBe(originalBooking.bookingId);
      expect(res2.body.data.bookingReference).toBe(originalBooking.bookingReference);

      // Verify only 1 booking row in DB
      const [rows] = await pool.query('SELECT COUNT(*) AS count FROM bookings WHERE idempotency_key = ?', [seqKey]);
      expect(rows[0].count).toBe(1);
    });

    it('same key with different payload returns 409', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Idempotency-Key', seqKey)
        .send({ eventId: 1, seatIds: [seatB] });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Idempotency key already used for a different request');
    });

    it('5 simultaneous requests with the same key via Promise.all: exactly one 201, four 200, one row, no 500s', async () => {
      const concurKey = `IDEM_CONCUR_${Date.now()}`;
      const targetSeats = [event1Seats[10].seatId, event1Seats[11].seatId];

      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${tokenA}`)
          .set('Idempotency-Key', concurKey)
          .send({ eventId: 1, seatIds: targetSeats })
      );

      const results = await Promise.all(requests);
      const statusCounts = {};
      for (const r of results) {
        statusCounts[r.statusCode] = (statusCounts[r.statusCode] || 0) + 1;
      }

      expect(statusCounts[500]).toBeUndefined();
      expect(statusCounts[201]).toBe(1);
      expect(statusCounts[200]).toBe(4);

      // SQL Proof: Exactly one booking row created for concurKey
      const [rows] = await pool.query('SELECT COUNT(*) AS count FROM bookings WHERE idempotency_key = ?', [concurKey]);
      expect(rows[0].count).toBe(1);
    });
  });

  // --- REQUIREMENT 10: Rollback ---
  describe('10. Mid-Transaction Rollback', () => {
    it('forces a failure mid-transaction (on booking_seats insert) and asserts nothing was committed', async () => {
      const rollbackSeat = event1Seats[12].seatId;

      // Ensure seat is currently AVAILABLE
      const [initSeat] = await pool.query('SELECT status FROM seats WHERE seat_id = ?', [rollbackSeat]);
      expect(initSeat[0].status).toBe('AVAILABLE');

      const [countBefore] = await pool.query('SELECT COUNT(*) AS count FROM bookings');

      // Intercept getConnection to throw error when INSERT INTO booking_seats is called
      const realGetConnection = db.getConnection.bind(db);
      const spy = jest.spyOn(db, 'getConnection').mockImplementation(async () => {
        const conn = await realGetConnection();
        const origQuery = conn.query.bind(conn);
        conn.query = async (sql, params) => {
          if (typeof sql === 'string' && sql.includes('INSERT INTO booking_seats')) {
            throw new Error('SIMULATED_DATABASE_INSERT_FAILURE');
          }
          return origQuery(sql, params);
        };
        return conn;
      });

      try {
        const res = await request(app)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${tokenA}`)
          .send({
            eventId: 1,
            seatIds: [rollbackSeat]
          });

        expect(res.statusCode).toBe(500);

        // SQL Proof: Booking was rolled back (no new row)
        const [countAfter] = await pool.query('SELECT COUNT(*) AS count FROM bookings');
        expect(countAfter[0].count).toBe(countBefore[0].count);

        // SQL Proof: No booking_seats row created
        const [bsRows] = await pool.query('SELECT COUNT(*) AS count FROM booking_seats WHERE seat_id = ?', [rollbackSeat]);
        expect(bsRows[0].count).toBe(0);

        // SQL Proof: Seat is STILL AVAILABLE
        const [finalSeat] = await pool.query('SELECT status FROM seats WHERE seat_id = ?', [rollbackSeat]);
        expect(finalSeat[0].status).toBe('AVAILABLE');
      } finally {
        spy.mockRestore();
      }
    });
  });

  // --- REQUIREMENT 11: Non-First Section Bookings ---
  describe('11. Non-First Section Bookings & Lifecycle', () => {
    it('seats from a non-first section can be booked, cancelled, and rebooked', async () => {
      // Find an available seat in the non-first section ('Upper Tier') for Event 1
      const freshSeatsRes = await request(app).get('/api/v1/events/1/seats');
      const upperTierSeat = freshSeatsRes.body.data.seats.find(
        (s) => s.section === 'Upper Tier' && s.status === 'AVAILABLE'
      );
      expect(upperTierSeat).toBeDefined();
      expect(upperTierSeat.section).toBe('Upper Tier');
      expect(upperTierSeat.seatNumber).toContain('UPR-');

      // 1. Book the non-first section seat
      const bookRes = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          eventId: 1,
          seatIds: [upperTierSeat.seatId]
        });

      expect(bookRes.statusCode).toBe(201);
      expect(bookRes.body.data.status).toBe('CONFIRMED');
      const bookingId = bookRes.body.data.bookingId;

      // Verify seat is BOOKED
      const [bookedRow] = await pool.query('SELECT status FROM seats WHERE seat_id = ?', [upperTierSeat.seatId]);
      expect(bookedRow[0].status).toBe('BOOKED');

      // 2. Cancel the booking
      const cancelRes = await request(app)
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(cancelRes.statusCode).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      // Verify seat is released back to AVAILABLE
      const [availRow] = await pool.query('SELECT status FROM seats WHERE seat_id = ?', [upperTierSeat.seatId]);
      expect(availRow[0].status).toBe('AVAILABLE');

      // 3. Rebook the same seat by another user (User A)
      const rebookRes = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          eventId: 1,
          seatIds: [upperTierSeat.seatId]
        });

      expect(rebookRes.statusCode).toBe(201);
      expect(rebookRes.body.data.status).toBe('CONFIRMED');
      expect(rebookRes.body.data.seatNumbers).toEqual([upperTierSeat.seatNumber]);
    });
  });

  // --- REQUIREMENT 12: UTC Timezone & Timestamps ---
  describe('12. UTC Timezone Consistency (createdAt and cancelledAt)', () => {
    it('creates a booking with createdAt within 10 seconds of Date.now(), and cancelledAt never earlier than createdAt', async () => {
      // Pick an available seat for Event 2
      const freshSeatsRes = await request(app).get('/api/v1/events/2/seats');
      const targetSeat = freshSeatsRes.body.data.seats.find((s) => s.status === 'AVAILABLE');
      expect(targetSeat).toBeDefined();

      const testStartTime = Date.now();

      // 1. Create booking
      const bookRes = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          eventId: 2,
          seatIds: [targetSeat.seatId]
        });

      expect(bookRes.statusCode).toBe(201);
      const bookingId = bookRes.body.data.bookingId;

      // 2. Fetch booking and check createdAt
      const getRes = await request(app)
        .get(`/api/v1/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(getRes.statusCode).toBe(200);
      const createdAtIso = getRes.body.data.booking.createdAt;
      expect(createdAtIso).toBeDefined();

      const createdAtMs = new Date(createdAtIso).getTime();
      expect(Math.abs(createdAtMs - testStartTime)).toBeLessThanOrEqual(10000);

      // Verify from direct database row as well
      const [dbRows] = await pool.query(
        'SELECT created_at, cancelled_at FROM bookings WHERE booking_id = ?',
        [bookingId]
      );
      const dbCreatedMs = new Date(dbRows[0].created_at).getTime();
      expect(Math.abs(dbCreatedMs - testStartTime)).toBeLessThanOrEqual(10000);

      // 3. Cancel the booking
      const cancelRes = await request(app)
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(cancelRes.statusCode).toBe(200);

      // 4. Assert cancelledAt is never earlier than createdAt
      const [cancelledRows] = await pool.query(
        'SELECT created_at, cancelled_at FROM bookings WHERE booking_id = ?',
        [bookingId]
      );
      const finalCreatedMs = new Date(cancelledRows[0].created_at).getTime();
      const finalCancelledMs = new Date(cancelledRows[0].cancelled_at).getTime();

      expect(finalCancelledMs).toBeGreaterThanOrEqual(finalCreatedMs);
      expect(Math.abs(finalCancelledMs - Date.now())).toBeLessThanOrEqual(10000);
    });
  });

  // --- REQUIREMENT 13: Tiered Pricing & Price Integrity ---
  describe('13. Tiered Pricing & Price Integrity', () => {
    it('multi-seat booking across two tiers: total equals exact sum of individual seat prices', async () => {
      // Find one VIP Floor seat (3000) and one STANDARD Upper Tier seat (1500)
      const freshSeats = await request(app).get('/api/v1/events/1/seats');
      const vipSeat = freshSeats.body.data.seats.find(
        (s) => s.tier === 'VIP' && s.status === 'AVAILABLE'
      );
      const standardSeat = freshSeats.body.data.seats.find(
        (s) => s.tier === 'STANDARD' && s.status === 'AVAILABLE'
      );
      expect(vipSeat).toBeDefined();
      expect(standardSeat).toBeDefined();

      const expectedTotal = vipSeat.price + standardSeat.price; // 3000 + 1500 = 4500
      expect(expectedTotal).toBe(4500);

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          eventId: 1,
          seatIds: [vipSeat.seatId, standardSeat.seatId]
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.totalAmount).toBe(4500);
      expect(res.body.data.seats).toBeDefined();
      expect(res.body.data.seats.length).toBe(2);

      const resVip = res.body.data.seats.find((s) => s.seatId === vipSeat.seatId);
      const resStandard = res.body.data.seats.find((s) => s.seatId === standardSeat.seatId);
      expect(resVip.tier).toBe('VIP');
      expect(resVip.price).toBe(3000);
      expect(resStandard.tier).toBe('STANDARD');
      expect(resStandard.price).toBe(1500);

      // Verify price_paid is stored per seat in database
      const [multiBsRows] = await pool.query(
        'SELECT seat_id, price_paid FROM booking_seats WHERE booking_id = ? ORDER BY seat_id ASC',
        [res.body.data.bookingId]
      );
      expect(multiBsRows).toHaveLength(2);
      expect(Number(multiBsRows.find((r) => r.seat_id === vipSeat.seatId).price_paid)).toBe(3000);
      expect(Number(multiBsRows.find((r) => r.seat_id === standardSeat.seatId).price_paid)).toBe(1500);
    });

    it('client-sent price or total in POST body is strictly ignored', async () => {
      const freshSeats = await request(app).get('/api/v1/events/1/seats');
      const availSeat = freshSeats.body.data.seats.find((s) => s.status === 'AVAILABLE');
      expect(availSeat).toBeDefined();

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          eventId: 1,
          seatIds: [availSeat.seatId],
          price: 1,
          totalAmount: 1,
          tier: 'DISCOUNT'
        });

      expect(res.statusCode).toBe(201);
      // Must equal the server-calculated price, NOT 1
      expect(res.body.data.totalAmount).toBe(availSeat.price);
      expect(res.body.data.seats[0].price).toBe(availSeat.price);
      expect(res.body.data.seats[0].tier).toBe(availSeat.tier);
    });

    it('historical price snapshot: booking retains price_paid even after direct DB price updates on seats', async () => {
      const freshSeats = await request(app).get('/api/v1/events/1/seats');
      const availSeat = freshSeats.body.data.seats.find((s) => s.status === 'AVAILABLE');
      expect(availSeat).toBeDefined();
      const originalPrice = availSeat.price;

      // 1. Create booking
      const bookRes = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          eventId: 1,
          seatIds: [availSeat.seatId]
        });

      expect(bookRes.statusCode).toBe(201);
      const bookingId = bookRes.body.data.bookingId;
      expect(bookRes.body.data.totalAmount).toBe(originalPrice);

      // Verify price_paid is stored per seat in DB
      const [bsRows] = await pool.query(
        'SELECT price_paid FROM booking_seats WHERE booking_id = ? AND seat_id = ?',
        [bookingId, availSeat.seatId]
      );
      expect(bsRows).toHaveLength(1);
      expect(Number(bsRows[0].price_paid)).toBe(originalPrice);

      // 2. Direct DB UPDATE changing seats table price to 9999
      await pool.query('UPDATE seats SET price = 9999.00 WHERE seat_id = ?', [availSeat.seatId]);

      // 3. Query GET /bookings/:id and GET /bookings/my
      const getRes = await request(app)
        .get(`/api/v1/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(getRes.statusCode).toBe(200);
      expect(getRes.body.data.booking.totalAmount).toBe(originalPrice);
      expect(getRes.body.data.booking.seats[0].price).toBe(originalPrice);

      const myRes = await request(app)
        .get('/api/v1/bookings/my')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(myRes.statusCode).toBe(200);
      const myBooking = myRes.body.data.bookings.find((b) => b.bookingId === bookingId);
      expect(myBooking).toBeDefined();
      expect(myBooking.totalAmount).toBe(originalPrice);
      expect(myBooking.seats[0].price).toBe(originalPrice);
    });

    it('idempotency replay returns identical totalAmount and seats array', async () => {
      const replayKey = `TIER_IDEM_${Date.now()}`;
      const freshSeats = await request(app).get('/api/v1/events/1/seats');
      const availSeat = freshSeats.body.data.seats.find((s) => s.status === 'AVAILABLE');
      expect(availSeat).toBeDefined();

      const res1 = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Idempotency-Key', replayKey)
        .send({
          eventId: 1,
          seatIds: [availSeat.seatId]
        });

      expect(res1.statusCode).toBe(201);
      const originalData = res1.body.data;

      // Replay
      const res2 = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Idempotency-Key', replayKey)
        .send({
          eventId: 1,
          seatIds: [availSeat.seatId]
        });

      expect(res2.statusCode).toBe(200);
      expect(res2.body.data.totalAmount).toBe(originalData.totalAmount);
      expect(res2.body.data.seats).toEqual(originalData.seats);
    });
  });
});

