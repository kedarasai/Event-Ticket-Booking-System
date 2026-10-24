const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');

describe('Express Foundation & Health Check', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('GET /api/v1/health should return 200 and database status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('UP');
    expect(res.body.data.database).toBeDefined();
  });

  it('GET /api/v1/unmapped-route should return 404 JSON', async () => {
    const res = await request(app).get('/api/v1/unmapped-route');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Cannot GET /api/v1/unmapped-route');
  });

  it('POST with malformed JSON body should return 400 JSON', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ "email": "broken"'); // Malformed JSON

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Malformed JSON payload in request body');
  });
});
