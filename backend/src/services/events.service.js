const eventsRepository = require('../repositories/events.repository');
const AppError = require('../utils/AppError');

/**
 * Events Service
 * Business logic layer for public event querying and pagination.
 */
class EventsService {
  async getEvents({ search, page, limit }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 12));

    const [events, total] = await Promise.all([
      eventsRepository.findAll({ search, page: pageNum, limit: limitNum }),
      eventsRepository.countAll({ search })
    ]);

    return {
      events,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total
      }
    };
  }

  async getEventById(eventId) {
    const id = Number(eventId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('Event ID must be a positive integer', 400);
    }

    const event = await eventsRepository.findById(id);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    return { event };
  }
}

module.exports = new EventsService();
