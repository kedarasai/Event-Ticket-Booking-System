const bookingsService = require('../services/bookings.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

/**
 * Bookings Controller
 * Delegates booking lifecycle requests to BookingsService.
 */
class BookingsController {
  createBooking = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { eventId, seatIds } = req.body;
    const idempotencyKey = req.header('Idempotency-Key');

    const result = await bookingsService.createBooking(
      userId,
      { eventId, seatIds },
      idempotencyKey
    );

    const message =
      result.statusCode === 201
        ? 'Booking confirmed successfully'
        : 'Booking retrieved successfully';

    return sendSuccess(res, result.statusCode, message, result.booking);
  });

  getMyBookings = asyncHandler(async (req, res) => {
    const data = await bookingsService.getMyBookings(req.user?.userId);
    return sendSuccess(res, 200, 'Bookings retrieved successfully', data);
  });

  getBookingById = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const data = await bookingsService.getBookingById(bookingId, req.user);
    return sendSuccess(res, 200, 'Booking retrieved successfully', data);
  });

  cancelBooking = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const data = await bookingsService.cancelBooking(bookingId, req.user);
    return sendSuccess(res, 200, 'Booking cancelled successfully', data);
  });
}

module.exports = new BookingsController();
