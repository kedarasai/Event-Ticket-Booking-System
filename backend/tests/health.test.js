const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');

describe('Express Foundation & Health Check', () => {

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

  describe('CORS Configuration', () => {
    it('an Origin of http://localhost:5174 gets an Access-Control-Allow-Origin header equal to that origin', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:5174');

      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5174');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('http://127.0.0.1:3000 is allowed', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://127.0.0.1:3000');

      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3000');
    });

    it('https://evil.example.com gets no Access-Control-Allow-Origin header', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'https://evil.example.com');

      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('a request with no Origin works', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    describe('with NODE_ENV=production', () => {
      const savedEnv = process.env.NODE_ENV;
      const savedCors = process.env.CORS_ORIGIN;

      beforeAll(() => {
        process.env.NODE_ENV = 'production';
        process.env.CORS_ORIGIN = 'https://allowed.example.com, https://admin.example.com';
      });

      afterAll(() => {
        process.env.NODE_ENV = savedEnv;
        process.env.CORS_ORIGIN = savedCors;
      });

      it('http://localhost:5174 is NOT allowed', async () => {
        const res = await request(app)
          .get('/api/v1/health')
          .set('Origin', 'http://localhost:5174');

        expect(res.statusCode).toBe(200);
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
      });

      it('an origin listed in CORS_ORIGIN is allowed', async () => {
        const res = await request(app)
          .get('/api/v1/health')
          .set('Origin', 'https://allowed.example.com');

        expect(res.statusCode).toBe(200);
        expect(res.headers['access-control-allow-origin']).toBe('https://allowed.example.com');
      });
    });
  });
});
