const bookingsService = require('../services/bookings.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

/**
 * Bookings Controller
 * Delegates booking lifecycle requests to BookingsService.
 */
class BookingsController {
  createBooking = asyncHandler(async (req, res) => {
    const { eventId, seatIds } = req.body;
    const idempotencyKey = req.header('Idempotency-Key');
    const data = await bookingsService.createBooking({
      userId: req.user?.userId,
      eventId,
      seatIds,
      idempotencyKey
    });
    return sendSuccess(res, 201, 'Booking created successfully', data);
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
