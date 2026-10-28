const request = require('supertest');
const app = require('../src/app');

describe('Events and Seats Integration Tests (Requirement 2)', () => {
  const expectedEventFields = [
    'eventId',
    'title',
    'description',
    'venue',
    'eventDate',
    'price',
    'priceMax',
    'category',
    'layoutType',
    'imageUrl',
    'availableSeats',
    'totalSeats'
  ];

  it('list: GET /events should return 200 with list of upcoming events and exact contract fields', async () => {
    const res = await request(app).get('/api/v1/events');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.events)).toBe(true);
    expect(res.body.data.events.length).toBe(2);

    const firstEvent = res.body.data.events[0];
    for (const field of expectedEventFields) {
      expect(firstEvent).toHaveProperty(field);
    }

    expect(typeof firstEvent.eventId).toBe('number');
    expect(typeof firstEvent.title).toBe('string');
    expect(typeof firstEvent.eventDate).toBe('string');
    expect(new Date(firstEvent.eventDate).toISOString()).toBe(firstEvent.eventDate);
    expect(typeof firstEvent.price).toBe('number');
    expect(typeof firstEvent.priceMax).toBe('number');
    expect(firstEvent.price).toBe(1500);
    expect(firstEvent.priceMax).toBe(3000);
    expect(firstEvent.layoutType).toBe('ARENA');
    expect(res.body.data.events[1].layoutType).toBe('AUDITORIUM');
    expect(res.body.data.events[1].price).toBe(2500);
    expect(res.body.data.events[1].priceMax).toBe(3500);
    expect(firstEvent.totalSeats).toBe(20);
    expect(firstEvent.availableSeats).toBe(20);

    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.limit).toBe(12);
    expect(res.body.data.pagination.total).toBe(2);
  });

  it('search: GET /events?search=Concert should return matching events', async () => {
    const res = await request(app).get('/api/v1/events?search=Concert');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.events.length).toBe(1);
    expect(res.body.data.events[0].category).toBe('Concert');
    expect(res.body.data.events[0].title).toContain('Concert');
  });

  it('pagination: GET /events?page=1&limit=1 should return 1 event on page 1 with total 2', async () => {
    const res = await request(app).get('/api/v1/events?page=1&limit=1');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.events.length).toBe(1);
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.limit).toBe(1);
    expect(res.body.data.pagination.total).toBe(2);
  });

  it('detail: GET /events/:eventId with valid id should return 200 and single event with tiers', async () => {
    const res = await request(app).get('/api/v1/events/1');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.event).toBeDefined();

    const ev = res.body.data.event;
    for (const field of expectedEventFields) {
      expect(ev).toHaveProperty(field);
    }
    expect(ev.eventId).toBe(1);
    expect(ev.layoutType).toBe('ARENA');
    expect(ev.price).toBe(1500);
    expect(ev.priceMax).toBe(3000);
    expect(ev.totalSeats).toBe(20);
    expect(ev.availableSeats).toBe(20);
    expect(Array.isArray(ev.tiers)).toBe(true);
    expect(ev.tiers.length).toBe(2);
    expect(ev.tiers[0]).toEqual({ tier: 'VIP', price: 3000, totalSeats: 10, availableSeats: 10 });
    expect(ev.tiers[1]).toEqual({ tier: 'STANDARD', price: 1500, totalSeats: 10, availableSeats: 10 });
  });

  it('seats: GET /events/:eventId/seats should return 200 with 20 seats, natural ordering, and no-store header', async () => {
    const res = await request(app).get('/api/v1/events/1/seats');

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.success).toBe(true);

    const { eventId, seats } = res.body.data;
    expect(eventId).toBe(1);
    expect(res.body.data.price).toBeUndefined();
    expect(Array.isArray(seats)).toBe(true);
    expect(seats.length).toBe(20);

    // Section and Natural ordering checks: FLR-A1..FLR-A10, UPR-A1..UPR-A10
    expect(seats[0].section).toBe('Floor');
    expect(seats[0].tier).toBe('VIP');
    expect(seats[0].price).toBe(3000);
    expect(seats[0].seatNumber).toBe('FLR-A1');
    expect(seats[0].row).toBe('A');
    expect(seats[0].number).toBe(1);

    expect(seats[9].section).toBe('Floor');
    expect(seats[9].tier).toBe('VIP');
    expect(seats[9].price).toBe(3000);
    expect(seats[9].seatNumber).toBe('FLR-A10');
    expect(seats[9].number).toBe(10);

    expect(seats[10].section).toBe('Upper Tier');
    expect(seats[10].tier).toBe('STANDARD');
    expect(seats[10].price).toBe(1500);
    expect(seats[10].seatNumber).toBe('UPR-A1');
    expect(seats[10].number).toBe(1);

    expect(seats[19].section).toBe('Upper Tier');
    expect(seats[19].tier).toBe('STANDARD');
    expect(seats[19].price).toBe(1500);
    expect(seats[19].seatNumber).toBe('UPR-A10');
    expect(seats[19].number).toBe(10);

    // All start AVAILABLE in pristine seed
    const available = seats.filter((s) => s.status === 'AVAILABLE');
    expect(available.length).toBe(20);
  });

  it('invalid id: GET /events/invalid-id should return 400', async () => {
    const res = await request(app).get('/api/v1/events/invalid-id');

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Event ID must be a positive integer');
  });

  it('invalid id: GET /events/invalid-id/seats should return 400', async () => {
    const res = await request(app).get('/api/v1/events/invalid-id/seats');

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Event ID must be a positive integer');
  });

  it('missing: GET /events/9999 should return 404', async () => {
    const res = await request(app).get('/api/v1/events/9999');

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Event not found');
  });

  it('missing: GET /events/9999/seats should return 404', async () => {
    const res = await request(app).get('/api/v1/events/9999/seats');

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Event not found');
  });
});
