const eventsRepository = require('../repositories/events.repository');
const AppError = require('../utils/AppError');

/**
 * Events Service
 * Business logic layer for event catalogue operations.
 */
class EventsService {
  async getEvents({ search, page, limit }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));

    const events = await eventsRepository.findAll({ search, page: pageNum, limit: limitNum });
    return {
      events,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: events.length // Total count logic can be enhanced in feature phase
      }
    };
  }

  async getEventById(eventId) {
    const event = await eventsRepository.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }
    return { event };
  }
}

module.exports = new EventsService();
