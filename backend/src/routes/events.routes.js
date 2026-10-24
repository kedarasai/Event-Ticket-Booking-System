const express = require('express');
const { query, param } = require('express-validator');

const eventsController = require('../controllers/events.controller');
const seatsRoutes = require('./seats.routes');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

// Mount seats sub-resource: /events/:eventId/seats
router.use('/:eventId/seats', seatsRoutes);

// Public route: GET /events
router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be an integer between 1 and 50')
  ]),
  eventsController.getEvents
);

// Public route: GET /events/:eventId
router.get(
  '/:eventId',
  validate([
    param('eventId').isInt({ min: 1 }).withMessage('Event ID must be a positive integer')
  ]),
  eventsController.getEventById
);

module.exports = router;
