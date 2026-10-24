const express = require('express');
const { param } = require('express-validator');
const seatsController = require('../controllers/seats.controller');
const validate = require('../middleware/validate.middleware');

const router = express.Router({ mergeParams: true });

router.get(
  '/',
  validate([
    param('eventId').isInt({ min: 1 }).withMessage('Event ID must be a positive integer')
  ]),
  seatsController.getSeats
);

module.exports = router;
