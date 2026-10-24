const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');

describe('Authentication Layer Integration Tests', () => {
  afterAll(async () => {
    await pool.end();
  });

  const uniqueSuffix = Date.now();
  const testUser = {
    name: 'Alice Test',
    email: `alice_${uniqueSuffix}@example.com`,
    password: 'Password123'
  };

  let testToken = '';

  it('POST /api/v1/auth/register should create user and return 201 with token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.user.role).toBe('USER');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.password_hash).toBeUndefined();

    testToken = res.body.data.token;
  });

  it('POST /api/v1/auth/register with duplicate email should return 409', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Email is already registered');
  });

  it('POST /api/v1/auth/register with weak password should return 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Weak Bob',
        email: `bob_${uniqueSuffix}@example.com`,
        password: 'weak' // < 8 chars and no digit
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Password must be at least 8 characters long|Password must contain at least one letter and one number/);
  });

  it('POST /api/v1/auth/login with valid credentials should return 200 and token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
  });

  it('POST /api/v1/auth/login with wrong password should return 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword999'
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('GET /api/v1/auth/me with valid Bearer token should return 200 and profile', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
  });

  it('GET /api/v1/auth/me without token should return 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Authentication required/);
  });

  it('GET /api/v1/auth/me with tampered token should return 401', async () => {
    const tamperedToken = testToken.slice(0, -6) + 'abcdef';
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tamperedToken}`);

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid or expired authentication token.');
  });

  it('POST /api/v1/auth/login with seeded demo@example.com should return 200', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'demo@example.com',
        password: 'Demo@1234'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('demo@example.com');
    expect(res.body.data.user.role).toBe('USER');
  });
});
