const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');

describe('Concurrency Integration Tests (Requirement 7)', () => {
  let userTokens = [];
  let event2Seats = [];

  beforeAll(async () => {
    // Register & login 20 distinct users
    const tokens = [];
    for (let i = 1; i <= 20; i++) {
      const email = `concur_user_${i}@example.com`;
      const password = 'Password123';

      await request(app)
        .post('/api/v1/auth/register')
        .send({ name: `Concur User ${i}`, email, password });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password });

      tokens.push(loginRes.body.data.token);
    }
    userTokens = tokens;

    // Fetch seats for Event 2
    const seatsRes = await request(app).get('/api/v1/events/2/seats');
    event2Seats = seatsRes.body.data.seats;
  });

  it('20 simultaneous requests for the same seat: exactly one 201, nineteen 409, no 500s, and exactly one active booking_seats row', async () => {
    const targetSeat = event2Seats[0];

    const requests = userTokens.map((token, index) =>
      request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventId: 2,
          seatIds: [targetSeat.seatId]
        })
        .then((res) => ({ userIndex: index + 1, statusCode: res.statusCode, body: res.body }))
    );

    const results = await Promise.all(requests);

    const statusCounts = {};
    for (const r of results) {
      statusCounts[r.statusCode] = (statusCounts[r.statusCode] || 0) + 1;
    }

    expect(statusCounts[500]).toBeUndefined();
    expect(statusCounts[201]).toBe(1);
    expect(statusCounts[409]).toBe(19);

    // Direct SQL Verification:
    // 1. Seat is BOOKED
    const [seatRows] = await pool.query('SELECT status FROM seats WHERE seat_id = ?', [targetSeat.seatId]);
    expect(seatRows[0].status).toBe('BOOKED');

    // 2. Exactly 1 active booking_seats row
    const [bsRows] = await pool.query(
      'SELECT COUNT(*) AS count FROM booking_seats WHERE seat_id = ? AND is_active = 1',
      [targetSeat.seatId]
    );
    expect(bsRows[0].count).toBe(1);
  });

  it('overlapping multi-seat requests ([1,2], [2,3], [3,1]): no 500s, at most one winner per seat', async () => {
    const seatA = event2Seats[1].seatId;
    const seatB = event2Seats[2].seatId;
    const seatC = event2Seats[3].seatId;

    // 3 overlapping requests: [A, B], [B, C], [C, A]
    const req1 = request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${userTokens[0]}`)
      .send({ eventId: 2, seatIds: [seatA, seatB] });

    const req2 = request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${userTokens[1]}`)
      .send({ eventId: 2, seatIds: [seatB, seatC] });

    const req3 = request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${userTokens[2]}`)
      .send({ eventId: 2, seatIds: [seatC, seatA] });

    const results = await Promise.all([req1, req2, req3]);

    const statusCounts = {};
    for (const r of results) {
      statusCounts[r.statusCode] = (statusCounts[r.statusCode] || 0) + 1;
    }

    // Zero 500s
    expect(statusCounts[500]).toBeUndefined();

    // Responses must be either 201 or 409
    for (const r of results) {
      expect([201, 409]).toContain(r.statusCode);
    }

    // Since each request shares seats with both of the other requests ([A,B], [B,C], [C,A]),
    // at most 1 request can possibly win, because if any request wins, 2 of the 3 seats are taken!
    expect(statusCounts[201] || 0).toBeLessThanOrEqual(1);

    // Direct SQL Verification: at most one active booking_seats row per seat
    for (const seatId of [seatA, seatB, seatC]) {
      const [bsRows] = await pool.query(
        'SELECT COUNT(*) AS count FROM booking_seats WHERE seat_id = ? AND is_active = 1',
        [seatId]
      );
      expect(bsRows[0].count).toBeLessThanOrEqual(1);
    }
  });
});
