const crypto = require('crypto');
const db = require('../config/database');
const bookingsRepository = require('../repositories/bookings.repository');
const AppError = require('../utils/AppError');

/**
 * Bookings Service
 * Implements strict zero-double-booking reservation workflow guaranteed by
 * MySQL row-level locking (SELECT ... FOR UPDATE) and transactions.
 */
class BookingsService {
  /**
   * Helper to validate input payloads
   */
  validateBookingInput({ eventId, seatIds, idempotencyKey }) {
    const id = Number(eventId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('Event ID must be a positive integer', 400);
    }

    if (!Array.isArray(seatIds) || seatIds.length === 0 || seatIds.length > 8) {
      throw new AppError('seatIds must be a non-empty array with at most 8 seats', 400);
    }

    const uniqueSet = new Set();
    const sortedSeatIds = [];
    for (const seatId of seatIds) {
      const numId = Number(seatId);
      if (!Number.isInteger(numId) || numId <= 0) {
        throw new AppError('Each seat ID must be a positive integer', 400);
      }
      if (uniqueSet.has(numId)) {
        throw new AppError('Duplicate seat IDs are not allowed in a single booking request', 400);
      }
      uniqueSet.add(numId);
      sortedSeatIds.push(numId);
    }

    // Sort seat IDs in ascending order to prevent deadlocks across concurrent requests
    sortedSeatIds.sort((a, b) => a - b);

    if (idempotencyKey !== undefined && idempotencyKey !== null && idempotencyKey !== '') {
      if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(idempotencyKey)) {
        throw new AppError('Idempotency-Key must be 8-64 characters matching [A-Za-z0-9_-]', 400);
      }
    }

    return {
      validatedEventId: id,
      sortedSeatIds,
      sanitizedKey: idempotencyKey ? idempotencyKey.trim() : null
    };
  }

  /**
   * Check if an existing booking matches the requested payload
   */
  isPayloadMatch(existing, eventId, sortedSeatIds) {
    if (existing.eventId !== eventId) return false;
    if (existing.seatIds.length !== sortedSeatIds.length) return false;
    for (let i = 0; i < sortedSeatIds.length; i++) {
      if (existing.seatIds[i] !== sortedSeatIds[i]) return false;
    }
    return true;
  }

  async createBooking(userId, { eventId, seatIds }, idempotencyKey) {
    // 1. Validate inputs
    const { validatedEventId, sortedSeatIds, sanitizedKey } = this.validateBookingInput({
      eventId,
      seatIds,
      idempotencyKey
    });

    // 2. Idempotency pre-check: quick lookup before locking transactions
    if (sanitizedKey) {
      const existing = await bookingsRepository.findExistingBookingByIdempotency(userId, sanitizedKey);
      if (existing) {
        if (this.isPayloadMatch(existing, validatedEventId, sortedSeatIds)) {
          return { statusCode: 200, booking: existing };
        }
        throw new AppError('Idempotency key already used for a different request', 409);
      }
    }

    // 3. Acquire ONE dedicated connection from the pool
    const connection = await db.getConnection();
    let connectionReleased = false;
    const releaseConnection = () => {
      if (!connectionReleased && connection) {
        connectionReleased = true;
        connection.release();
      }
    };

    const maxDeadlockRetries = 3;
    let deadlockAttempts = 0;

    try {
      while (deadlockAttempts < maxDeadlockRetries) {
        deadlockAttempts++;

        try {
          // 4. Start transaction
          await connection.query('START TRANSACTION');

          // 5. Verify event existence and upcoming status in SQL with shared lock
          const [eventRows] = await connection.query(
            'SELECT price, (event_date > UTC_TIMESTAMP()) AS is_upcoming FROM events WHERE event_id = ? FOR SHARE',
            [validatedEventId]
          );

          if (!eventRows.length) {
            await connection.query('ROLLBACK');
            releaseConnection();
            throw new AppError('Event not found', 404);
          }

          if (!eventRows[0].is_upcoming) {
            await connection.query('ROLLBACK');
            releaseConnection();
            throw new AppError('Event has already taken place or is not upcoming', 400);
          }

          // 6. Lock requested seats in ascending order to prevent deadlocks (SELECT ... FOR UPDATE)
          const seatPlaceholders = sortedSeatIds.map(() => '?').join(',');
          const [seatRows] = await connection.query(
            `SELECT seat_id, seat_number, section, tier, price, status 
             FROM seats 
             WHERE event_id = ? AND seat_id IN (${seatPlaceholders}) 
             ORDER BY seat_id ASC FOR UPDATE`,
            [validatedEventId, ...sortedSeatIds]
          );

          // Compute total amount by summing integer paise across the locked seat rows
          let totalPaise = 0;
          for (const seat of seatRows) {
            totalPaise += Math.round(Number(seat.price) * 100);
          }
          const totalAmountDecimal = (totalPaise / 100).toFixed(2);
          const totalAmount = Number(totalAmountDecimal);

          // 7. Verify all requested seats exist for this event
          if (seatRows.length !== sortedSeatIds.length) {
            await connection.query('ROLLBACK');
            releaseConnection();
            throw new AppError('One or more selected seats do not exist for this event', 404);
          }

          // 8. Verify every requested seat is currently AVAILABLE
          const hasUnavailableSeat = seatRows.some((seat) => seat.status !== 'AVAILABLE');
          if (hasUnavailableSeat) {
            await connection.query('ROLLBACK');
            releaseConnection();

            // IDEMPOTENCY RACE AMENDMENT:
            // If another concurrent request with the same Idempotency-Key just booked these seats,
            // check if our idempotency record now exists and return 200 if the payload matches.
            if (sanitizedKey) {
              let existing = await bookingsRepository.findExistingBookingByIdempotency(userId, sanitizedKey);
              if (!existing) {
                for (let retry = 0; retry < 5 && !existing; retry++) {
                  await new Promise((res) => setTimeout(res, 25));
                  existing = await bookingsRepository.findExistingBookingByIdempotency(userId, sanitizedKey);
                }
              }
              if (existing) {
                if (this.isPayloadMatch(existing, validatedEventId, sortedSeatIds)) {
                  return { statusCode: 200, booking: existing };
                }
                throw new AppError('Idempotency key already used for a different request', 409);
              }
            }

            throw new AppError('One or more selected seats are no longer available.', 409);
          }

          // 9. Generate booking reference with collision retry (capped at 3)
          let bookingReference;
          let bookingId;
          let refCollisionRetries = 0;

          while (refCollisionRetries < 3) {
            bookingReference = 'EVT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
            try {
              const [bookingResult] = await connection.query(
                `INSERT INTO bookings (user_id, event_id, booking_reference, status, total_amount, idempotency_key)
                 VALUES (?, ?, ?, 'CONFIRMED', ?, ?)`,
                [userId, validatedEventId, bookingReference, totalAmountDecimal, sanitizedKey]
              );
              bookingId = bookingResult.insertId;
              break;
            } catch (err) {
              if (err.code === 'ER_DUP_ENTRY' && err.message.includes('uq_bookings_reference')) {
                refCollisionRetries++;
                if (refCollisionRetries >= 3) {
                  throw new AppError('Failed to generate a unique booking reference after 3 attempts', 500);
                }
                continue;
              }
              throw err;
            }
          }

          if (!bookingId) {
            throw new AppError('Failed to generate a unique booking reference after 3 attempts', 500);
          }

          // 10. Insert booking_seats allocation rows (is_active = TRUE) with price_paid per seat
          const bookingSeatValues = seatRows.map((s) => [
            bookingId,
            s.seat_id,
            Number(s.price).toFixed(2),
            true
          ]);
          await connection.query(
            'INSERT INTO booking_seats (booking_id, seat_id, price_paid, is_active) VALUES ?',
            [bookingSeatValues]
          );

          // 11. Atomic update of seats status to 'BOOKED'
          const [updateResult] = await connection.query(
            `UPDATE seats 
             SET status = 'BOOKED' 
             WHERE event_id = ? AND status = 'AVAILABLE' AND seat_id IN (${seatPlaceholders})`,
            [validatedEventId, ...sortedSeatIds]
          );

          if (updateResult.affectedRows !== sortedSeatIds.length) {
            await connection.query('ROLLBACK');
            releaseConnection();
            throw new AppError('One or more selected seats are no longer available.', 409);
          }

          // 12. Commit transaction
          await connection.query('COMMIT');
          releaseConnection();

          // Format naturally sorted seats array and seat numbers
          const seats = seatRows
            .map((s) => ({
              seatId: s.seat_id,
              seatNumber: s.seat_number,
              section: s.section,
              tier: s.tier,
              price: Number(s.price)
            }))
            .sort((a, b) => a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true }));

          const seatNumbers = seats.map((s) => s.seatNumber);

          return {
            statusCode: 201,
            booking: {
              bookingId,
              bookingReference,
              status: 'CONFIRMED',
              eventId: validatedEventId,
              seatIds: sortedSeatIds,
              seatNumbers,
              seats,
              totalAmount
            }
          };
        } catch (innerErr) {
          // Deadlock retry handling
          if (
            (innerErr.code === 'ER_LOCK_DEADLOCK' || innerErr.errno === 1213) &&
            deadlockAttempts < maxDeadlockRetries
          ) {
            if (!connectionReleased && connection) {
              try {
                await connection.query('ROLLBACK');
              } catch (_) {}
            }
            const jitterMs = 20 + Math.random() * 40;
            await new Promise((res) => setTimeout(res, jitterMs));
            continue;
          }

          // Rollback uncommitted transaction and release connection before processing error
          if (!connectionReleased && connection) {
            try {
              await connection.query('ROLLBACK');
            } catch (_) {}
            releaseConnection();
          }

          // Duplicate key handling
          if (innerErr.code === 'ER_DUP_ENTRY') {
            // Case A: Idempotency duplicate key collision
            if (innerErr.message.includes('uq_bookings_user_idempotency')) {
              if (sanitizedKey) {
                let existing = await bookingsRepository.findExistingBookingByIdempotency(userId, sanitizedKey);
                for (let retry = 0; retry < 5 && !existing; retry++) {
                  await new Promise((res) => setTimeout(res, 25));
                  existing = await bookingsRepository.findExistingBookingByIdempotency(userId, sanitizedKey);
                }
                if (existing) {
                  if (this.isPayloadMatch(existing, validatedEventId, sortedSeatIds)) {
                    return { statusCode: 200, booking: existing };
                  }
                  throw new AppError('Idempotency key already used for a different request', 409);
                }
              }
              throw new AppError('Idempotency key already used for a different request', 409);
            }

            // Case B: Active seat duplicate key collision (last line of defense)
            if (innerErr.message.includes('uq_booking_seats_active_seat')) {
              throw new AppError('One or more selected seats are no longer available.', 409);
            }

            // Case C: Other duplicate constraint
            throw new AppError('Database duplicate key constraint violation', 500);
          }

          if (innerErr instanceof AppError) {
            throw innerErr;
          }
          throw new AppError(innerErr.message || 'Transaction failed', 500);
        }
      }
    } finally {
      releaseConnection();
    }
  }

  async getMyBookings(userId) {
    const bookings = await bookingsRepository.findByUserId(userId);
    return { bookings };
  }

  async getBookingById(bookingId, currentUser) {
    const id = Number(bookingId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('Booking ID must be a positive integer', 400);
    }

    const booking = await bookingsRepository.findById(id);
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    if (currentUser.role !== 'ADMIN' && booking.userId !== currentUser.userId) {
      throw new AppError('Access forbidden', 403);
    }

    return {
      booking: {
        bookingId: booking.bookingId,
        bookingReference: booking.bookingReference,
        status: booking.status,
        totalAmount: booking.totalAmount,
        createdAt: booking.createdAt,
        event: booking.event,
        seatNumbers: booking.seatNumbers,
        seats: booking.seats,
        eventId: booking.eventId,
        seatIds: booking.seatIds
      }
    };
  }

  async cancelBooking(bookingId, currentUser) {
    const id = Number(bookingId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('Booking ID must be a positive integer', 400);
    }

    const connection = await db.getConnection();
    let connectionReleased = false;
    const releaseConnection = () => {
      if (!connectionReleased && connection) {
        connectionReleased = true;
        connection.release();
      }
    };

    try {
      await connection.query('START TRANSACTION');

      // 1. SELECT the booking FOR UPDATE
      const booking = await bookingsRepository.findBookingForCancel(connection, id);
      if (!booking) {
        await connection.query('ROLLBACK');
        releaseConnection();
        throw new AppError('Booking not found', 404);
      }

      // 2. Check ownership (owner or ADMIN, else 403)
      if (currentUser.role !== 'ADMIN' && booking.user_id !== currentUser.userId) {
        await connection.query('ROLLBACK');
        releaseConnection();
        throw new AppError('Access forbidden', 403);
      }

      // 3. Status must be CONFIRMED (else 409 "Booking already cancelled")
      if (booking.status !== 'CONFIRMED') {
        await connection.query('ROLLBACK');
        releaseConnection();
        throw new AppError('Booking already cancelled', 409);
      }

      // 4. Set CANCELLED + cancelled_at
      await bookingsRepository.updateBookingCancelled(connection, id);

      // 5. Set booking_seats.is_active = FALSE
      await bookingsRepository.deactivateBookingSeats(connection, id);

      // 6. Lock the booking's seats ORDER BY seat_id FOR UPDATE and set them AVAILABLE
      const seatIds = await bookingsRepository.getBookingSeatIds(connection, id);
      if (seatIds.length > 0) {
        await bookingsRepository.releaseSeats(connection, seatIds);
      }

      // 7. COMMIT
      await connection.query('COMMIT');
      releaseConnection();

      return {
        bookingId: id,
        status: 'CANCELLED'
      };
    } catch (err) {
      if (!connectionReleased && connection) {
        try {
          await connection.query('ROLLBACK');
        } catch (_) {}
      }
      releaseConnection();
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(err.message || 'Failed to cancel booking', 500);
    } finally {
      releaseConnection();
    }
  }
}

module.exports = new BookingsService();
