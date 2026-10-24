const express = require('express');
const eventsController = require('../controllers/events.controller');
const seatsRoutes = require('./seats.routes');

const router = express.Router();

router.use('/:eventId/seats', seatsRoutes);
router.get('/', eventsController.getEvents);
router.get('/:eventId', eventsController.getEventById);

module.exports = router;
