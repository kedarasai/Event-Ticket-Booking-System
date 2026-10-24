const express = require('express');
const seatsController = require('../controllers/seats.controller');

const router = express.Router({ mergeParams: true });

router.get('/', seatsController.getSeats);

module.exports = router;
