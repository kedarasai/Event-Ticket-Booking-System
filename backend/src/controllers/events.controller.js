const eventsService = require('../services/events.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

/**
 * Events Controller
 * Handles HTTP requests for event queries.
 */
class EventsController {
  getEvents = asyncHandler(async (req, res) => {
    const { search, page, limit } = req.query;
    const data = await eventsService.getEvents({ search, page, limit });
    return sendSuccess(res, 200, 'Events retrieved successfully', data);
  });

  getEventById = asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const data = await eventsService.getEventById(eventId);
    return sendSuccess(res, 200, 'Event retrieved successfully', data);
  });
}

module.exports = new EventsController();
