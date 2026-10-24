const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');

describe('Seats Endpoints Integration Tests', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('GET /api/v1/events/1/seats should return 200 with 96 seats, correct ordering, and no-store header', async () => {
    const res = await request(app).get('/api/v1/events/1/seats');

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.success).toBe(true);

    const { eventId, price, seats } = res.body.data;
    expect(eventId).toBe(1);
    expect(typeof price).toBe('number');
    expect(Array.isArray(seats)).toBe(true);
    expect(seats.length).toBe(96);

    // Verify ordering: A1, A2 ... H11, H12
    expect(seats[0].seatNumber).toBe('A1');
    expect(seats[0].row).toBe('A');
    expect(seats[0].number).toBe(1);

    expect(seats[11].seatNumber).toBe('A12');
    expect(seats[12].seatNumber).toBe('B1');
    expect(seats[95].seatNumber).toBe('H12');

    // Verify strictly ascending ordering by row then seat_col
    for (let i = 1; i < seats.length; i++) {
      const prev = seats[i - 1];
      const curr = seats[i];
      if (prev.row === curr.row) {
        expect(curr.number).toBeGreaterThan(prev.number);
      } else {
        expect(curr.row > prev.row).toBe(true);
      }
    }

    // Verify BOOKED seats count equals 12
    const bookedSeats = seats.filter((s) => s.status === 'BOOKED');
    const availableSeats = seats.filter((s) => s.status === 'AVAILABLE');
    expect(bookedSeats.length).toBe(12);
    expect(availableSeats.length).toBe(84);
  });

  it('GET /api/v1/events/9999/seats should return 404', async () => {
    const res = await request(app).get('/api/v1/events/9999/seats');

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Event not found');
  });

  it('GET /api/v1/events/invalid-id/seats should return 400', async () => {
    const res = await request(app).get('/api/v1/events/invalid-id/seats');

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Event ID must be a positive integer');
  });

  it('GET /api/v1/events/-1/seats should return 400', async () => {
    const res = await request(app).get('/api/v1/events/-1/seats');

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Event ID must be a positive integer');
  });
});
