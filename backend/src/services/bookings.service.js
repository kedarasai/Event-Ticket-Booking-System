const bookingsRepository = require('../repositories/bookings.repository');
const AppError = require('../utils/AppError');

/**
 * Bookings Service
 * Business logic layer for reservations, idempotency, and cancellation.
 */
class BookingsService {
  async createBooking({ userId, eventId, seatIds, idempotencyKey }) {
    // Zero-double-booking transaction write logic will be implemented in Phase 5
    return {
      message: 'Booking endpoint initialized'
    };
  }

  async getMyBookings(userId) {
    const bookings = await bookingsRepository.findByUserId(userId);
    return { bookings };
  }

  async getBookingById(bookingId, currentUser) {
    const booking = await bookingsRepository.findById(bookingId);
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    if (currentUser.role !== 'ADMIN' && booking.userId !== currentUser.userId) {
      throw new AppError('Access forbidden', 403);
    }

    return { booking };
  }

  async cancelBooking(bookingId, currentUser) {
    // Cancellation logic will be finalized in Phase 5
    return { bookingId, status: 'CANCELLED' };
  }
}

module.exports = new BookingsService();
