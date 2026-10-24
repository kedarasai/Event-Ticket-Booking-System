const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/config/db');

describe('Backend Smoke Test', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('GET / should return 200 and message', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Ticket Booking API is running');
  });

  it('GET /api/health should return database connection status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.solution).toBe(2);
  });
});
