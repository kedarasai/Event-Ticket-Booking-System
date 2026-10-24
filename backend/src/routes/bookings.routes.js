const express = require('express');
const bookingsController = require('../controllers/bookings.controller');
const { bookingLimiter } = require('../middleware/rateLimit.middleware');

const router = express.Router();

router.post('/', bookingLimiter, bookingsController.createBooking);
router.get('/my', bookingsController.getMyBookings);
router.get('/:bookingId', bookingsController.getBookingById);
router.post('/:bookingId/cancel', bookingsController.cancelBooking);

module.exports = router;
