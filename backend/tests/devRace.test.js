const request = require('supertest');
const app = require('../src/app');
const devRepository = require('../src/repositories/dev.repository');

describe('Dev Concurrency Race Integration Tests', () => {
  let token = '';
  let availableSeatId = null;

  beforeAll(async () => {
    // Authenticate userA
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'userA@example.com', password: 'UserA@1234' });
    token = loginRes.body.data.token;

    // Find an available seat for Event 2
    const seatsRes = await request(app).get('/api/v1/events/2/seats');
    const available = seatsRes.body.data.seats.find((s) => s.status === 'AVAILABLE');
    availableSeatId = available.seatId;
  });

  it('POST /api/v1/dev/race should run concurrent attempts with exactly 1 winner and N-1 rejected', async () => {
    const res = await request(app)
      .post('/api/v1/dev/race')
      .set('Authorization', `Bearer ${token}`)
      .send({
        eventId: 2,
        seatId: availableSeatId,
        attempts: 5
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.booked).toBe(1);
    expect(res.body.data.rejected).toBe(4);
    expect(res.body.data.results).toHaveLength(5);

    const winners = res.body.data.results.filter((r) => r.outcome === 'BOOKED');
    const losers = res.body.data.results.filter((r) => r.outcome === 'REJECTED');

    expect(winners).toHaveLength(1);
    expect(winners[0].status).toBe(201);
    expect(losers).toHaveLength(4);
    losers.forEach((l) => expect(l.status).toBe(409));

    // SQL verification: exactly ONE active booking_seats row
    const activeCount = await devRepository.countActiveBookingSeats(availableSeatId);
    expect(activeCount).toBe(1);
  });

  it('GET /api/v1/dev/race/check should confirm exactly 1 active booking for the seat', async () => {
    const checkRes = await request(app)
      .get(`/api/v1/dev/race/check?seatId=${availableSeatId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(checkRes.statusCode).toBe(200);
    expect(checkRes.body.data.activeCount).toBe(1);
  });

  it('POST /api/v1/dev/race/reset should cancel winning booking and release the seat', async () => {
    const resetRes = await request(app)
      .post('/api/v1/dev/race/reset')
      .set('Authorization', `Bearer ${token}`)
      .send({
        eventId: 2,
        seatId: availableSeatId
      });

    expect(resetRes.statusCode).toBe(200);
    expect(resetRes.body.data.status).toBe('AVAILABLE');

    // SQL verification: zero active booking_seats rows
    const activeCount = await devRepository.countActiveBookingSeats(availableSeatId);
    expect(activeCount).toBe(0);
  });

  it('POST /api/v1/dev/race should reject attempts < 2 or > 20', async () => {
    const resLow = await request(app)
      .post('/api/v1/dev/race')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId: 2, seatId: availableSeatId, attempts: 1 });
    expect(resLow.statusCode).toBe(400);

    const resHigh = await request(app)
      .post('/api/v1/dev/race')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId: 2, seatId: availableSeatId, attempts: 21 });
    expect(resHigh.statusCode).toBe(400);
  });

  it('dev routes should return 404 when NODE_ENV=production', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      let prodApp;
      jest.isolateModules(() => {
        prodApp = require('../src/app');
      });

      const res = await request(prodApp)
        .post('/api/v1/dev/race')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: 2, seatId: availableSeatId, attempts: 2 });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Cannot POST /api/v1/dev/race');

      const resetRes = await request(prodApp)
        .post('/api/v1/dev/race/reset')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: 2, seatId: availableSeatId });

      expect(resetRes.statusCode).toBe(404);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
