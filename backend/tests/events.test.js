const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');

describe('Events Endpoints Integration Tests', () => {
  afterAll(async () => {
    await pool.end();
  });

  const expectedFields = [
    'eventId',
    'title',
    'description',
    'venue',
    'eventDate',
    'price',
    'category',
    'imageUrl',
    'availableSeats',
    'totalSeats'
  ];

  it('GET /api/v1/events should return 200 with list of upcoming events and exact fields', async () => {
    const res = await request(app).get('/api/v1/events');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.events)).toBe(true);
    expect(res.body.data.events.length).toBeGreaterThan(0);

    const firstEvent = res.body.data.events[0];
    for (const field of expectedFields) {
      expect(firstEvent).toHaveProperty(field);
    }

    expect(typeof firstEvent.eventId).toBe('number');
    expect(typeof firstEvent.title).toBe('string');
    expect(typeof firstEvent.venue).toBe('string');
    expect(typeof firstEvent.eventDate).toBe('string');
    expect(new Date(firstEvent.eventDate).toISOString()).toBe(firstEvent.eventDate);
    expect(typeof firstEvent.price).toBe('number');
    expect(typeof firstEvent.category).toBe('string');
    expect(typeof firstEvent.availableSeats).toBe('number');
    expect(typeof firstEvent.totalSeats).toBe('number');

    // Check pre-booked seats
    expect(firstEvent.availableSeats).toBeLessThan(firstEvent.totalSeats);
    expect(firstEvent.totalSeats).toBe(96);
    expect(firstEvent.availableSeats).toBe(84);

    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.limit).toBe(12);
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(6);
  });

  it('GET /api/v1/events?search=Concert should return matching events', async () => {
    const res = await request(app).get('/api/v1/events?search=Concert');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.events.length).toBeGreaterThan(0);
    for (const ev of res.body.data.events) {
      const match =
        ev.title.includes('Concert') ||
        ev.category.includes('Concert') ||
        ev.venue.includes('Concert');
      expect(match).toBe(true);
    }
  });

  it('GET /api/v1/events?page=2&limit=2 should return 2 events on page 2', async () => {
    const res = await request(app).get('/api/v1/events?page=2&limit=2');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.events.length).toBe(2);
    expect(res.body.data.pagination.page).toBe(2);
    expect(res.body.data.pagination.limit).toBe(2);
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(6);
  });

  it('GET /api/v1/events/:eventId with valid ID should return 200 and single event', async () => {
    const res = await request(app).get('/api/v1/events/1');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.event).toBeDefined();

    const ev = res.body.data.event;
    for (const field of expectedFields) {
      expect(ev).toHaveProperty(field);
    }

    expect(ev.eventId).toBe(1);
    expect(ev.availableSeats).toBe(84);
    expect(ev.totalSeats).toBe(96);
  });

  it('GET /api/v1/events/invalid-id should return 400', async () => {
    const res = await request(app).get('/api/v1/events/invalid-id');

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Event ID must be a positive integer');
  });

  it('GET /api/v1/events/-5 should return 400', async () => {
    const res = await request(app).get('/api/v1/events/-5');

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Event ID must be a positive integer');
  });

  it('GET /api/v1/events/9999 should return 404', async () => {
    const res = await request(app).get('/api/v1/events/9999');

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Event not found');
  });
});
