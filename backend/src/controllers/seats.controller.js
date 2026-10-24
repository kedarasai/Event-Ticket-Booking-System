const seatsService = require('../services/seats.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

/**
 * Seats Controller
 * Handles requests for seat maps.
 */
class SeatsController {
  getSeats = asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const data = await seatsService.getSeatsByEventId(eventId);

    // Fresh availability guarantee per specification
    res.setHeader('Cache-Control', 'no-store');

    return sendSuccess(res, 200, 'Seats retrieved successfully', data);
  });
}

module.exports = new SeatsController();
