const express = require('express');
const { body, header, param } = require('express-validator');
const bookingsController = require('../controllers/bookings.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { bookingLimiter } = require('../middleware/rateLimit.middleware');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

// All booking routes require authentication
router.use(authenticate);

const createBookingValidation = [
  body('eventId')
    .isInt({ min: 1 })
    .withMessage('Event ID must be a positive integer'),
  body('seatIds')
    .isArray({ min: 1, max: 8 })
    .withMessage('seatIds must be an array with 1 to 8 seats')
    .custom((seatIds) => {
      const unique = new Set(seatIds);
      if (unique.size !== seatIds.length) {
        throw new Error('Duplicate seat IDs are not allowed in a single booking request');
      }
      for (const id of seatIds) {
        const num = Number(id);
        if (!Number.isInteger(num) || num <= 0) {
          throw new Error('Each seat ID must be a positive integer');
        }
      }
      return true;
    }),
  header('Idempotency-Key')
    .optional({ values: 'falsy' })
    .matches(/^[A-Za-z0-9_-]{8,64}$/)
    .withMessage('Idempotency-Key must be 8-64 characters matching [A-Za-z0-9_-]')
];

const bookingIdParamValidation = [
  param('bookingId')
    .isInt({ min: 1 })
    .withMessage('Booking ID must be a positive integer')
];

router.post('/', bookingLimiter, validate(createBookingValidation), bookingsController.createBooking);
router.get('/my', bookingsController.getMyBookings);
router.get('/:bookingId', validate(bookingIdParamValidation), bookingsController.getBookingById);
router.post('/:bookingId/cancel', validate(bookingIdParamValidation), bookingsController.cancelBooking);

module.exports = router;
