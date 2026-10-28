const request = require('supertest');
const app = require('../src/app');

describe('Auth Integration Tests (Requirement 1)', () => {
  const uniqueSuffix = Date.now();
  const newUser = {
    name: 'New Test User',
    email: `newuser_${uniqueSuffix}@example.com`,
    password: 'Password123'
  };

  let token = '';

  it('register: should create user and return 201 with token and user object', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(newUser);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(newUser.email.toLowerCase());
    expect(res.body.data.user.role).toBe('USER');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.password_hash).toBeUndefined();

    token = res.body.data.token;
  });

  it('duplicate: should return 409 on duplicate email registration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(newUser);

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Email is already registered');
  });

  it('weak password: should return 400 for password less than 8 chars or missing numbers/letters', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Weak Bob',
        email: `bob_${uniqueSuffix}@example.com`,
        password: 'weak'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Password must be at least 8 characters long|Password must contain at least one letter and one number/);
  });

  it('login: should return 200 and token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: newUser.email,
        password: newUser.password
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(newUser.email.toLowerCase());
  });

  it('wrong password: should return 401 with generic error message', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: newUser.email,
        password: 'WrongPassword999'
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('protected route without token: GET /auth/me should return 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Authentication required/);
  });

  it('protected route with valid token: GET /auth/me should return 200 and profile', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(newUser.email.toLowerCase());
  });

  it('protected route with tampered token: GET /auth/me should return 401', async () => {
    const tampered = token.slice(0, -6) + 'xyz123';
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tampered}`);

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid or expired authentication token.');
  });

  it('seeded user: should log in seeded userA@example.com with 200', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'userA@example.com',
        password: 'UserA@1234'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('usera@example.com');
    expect(res.body.data.user.role).toBe('USER');
  });
});
