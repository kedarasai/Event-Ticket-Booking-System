const crypto = require('crypto');
const bcrypt = require('bcrypt');
const devRepository = require('../repositories/dev.repository');
const bookingsService = require('./bookings.service');
const AppError = require('../utils/AppError');

let cachedPasswordHash = null;

/**
 * Dev Service
 * Orchestrates dev-only high-concurrency race condition simulations.
 */
class DevService {
  /**
   * Ensure bcrypt hash exists for test users (cached for performance)
   */
  async getTestPasswordHash() {
    if (!cachedPasswordHash) {
      cachedPasswordHash = await bcrypt.hash('Password@123', 10);
    }
    return cachedPasswordHash;
  }

  /**
   * Validate race simulation input
   */
  validateRaceInput({ eventId, seatId, attempts }) {
    const eId = Number(eventId);
    if (!Number.isInteger(eId) || eId <= 0) {
      throw new AppError('eventId must be a positive integer', 400);
    }

    const sId = Number(seatId);
    if (!Number.isInteger(sId) || sId <= 0) {
      throw new AppError('seatId must be a positive integer', 400);
    }

    const att = Number(attempts);
    if (!Number.isInteger(att) || att < 2 || att > 20) {
      throw new AppError('attempts must be an integer between 2 and 20', 400);
    }

    return { eventId: eId, seatId: sId, attempts: att };
  }

  /**
   * Run high-concurrency race simulation against a single seat.
   * Calls the REAL bookingService.createBooking with Promise.all.
   */
  async runRace(body) {
    const { eventId, seatId, attempts } = this.validateRaceInput(body);

    const passwordHash = await this.getTestPasswordHash();

    // 1. Ensure `attempts` test users exist
    const userPromises = [];
    for (let i = 1; i <= attempts; i++) {
      const email = `race-user-${i}@example.com`;
      const name = `Race User ${i}`;
      userPromises.push(devRepository.ensureRaceUser(email, name, passwordHash));
    }
    const users = await Promise.all(userPromises);

    // 2. Fire concurrent booking requests using Promise.all
    const racePromises = users.map((user) => {
      return (async () => {
        const start = performance.now();
        const idemKey = crypto.randomUUID();
        try {
          const res = await bookingsService.createBooking(
            user.userId,
            { eventId, seatIds: [seatId] },
            idemKey
          );
          const elapsed = Math.round(performance.now() - start);
          const finishedAt = performance.now();
          return {
            user: user.email,
            outcome: 'BOOKED',
            status: res.statusCode || 201,
            ms: elapsed,
            finishedAt
          };
        } catch (err) {
          const elapsed = Math.round(performance.now() - start);
          const finishedAt = performance.now();
          return {
            user: user.email,
            outcome: 'REJECTED',
            status: err.statusCode || err.status || 409,
            ms: elapsed,
            finishedAt
          };
        }
      })();
    });

    const rawResults = await Promise.all(racePromises);

    // 3. Sort results by completion order (finishedAt ascending)
    rawResults.sort((a, b) => a.finishedAt - b.finishedAt);

    const results = rawResults.map(({ user, outcome, status, ms }) => ({
      user,
      outcome,
      status,
      ms
    }));

    const booked = results.filter((r) => r.outcome === 'BOOKED').length;
    const rejected = results.filter((r) => r.outcome === 'REJECTED').length;

    return {
      results,
      booked,
      rejected
    };
  }

  /**
   * Reset race winning booking to make the seat available again.
   */
  async resetRace({ eventId, seatId }) {
    const eId = Number(eventId);
    const sId = Number(seatId);
    if (!Number.isInteger(eId) || !Number.isInteger(sId) || eId <= 0 || sId <= 0) {
      throw new AppError('eventId and seatId must be positive integers', 400);
    }

    const activeBooking = await devRepository.findActiveBookingForSeat(eId, sId);
    if (activeBooking) {
      await bookingsService.cancelBooking(activeBooking.bookingId, {
        role: 'ADMIN',
        userId: activeBooking.userId
      });
    }

    return {
      seatId: sId,
      status: 'AVAILABLE'
    };
  }

  /**
   * Check active booking count for a seat (SQL check).
   */
  async checkSeatLock(seatId) {
    const sId = Number(seatId);
    if (!Number.isInteger(sId) || sId <= 0) {
      throw new AppError('seatId must be a positive integer', 400);
    }

    const activeCount = await devRepository.countActiveBookingSeats(sId);
    return {
      seatId: sId,
      activeCount
    };
  }
}

module.exports = new DevService();
