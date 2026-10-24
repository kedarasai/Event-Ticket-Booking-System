const seatsRepository = require('../repositories/seats.repository');
const AppError = require('../utils/AppError');

/**
 * Seats Service
 * Business logic for seat maps and seating availability.
 */
class SeatsService {
  async getSeatsByEventId(eventId) {
    const id = Number(eventId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('Event ID must be a positive integer', 400);
    }

    const data = await seatsRepository.findByEventId(id);
    if (!data) {
      throw new AppError('Event not found', 404);
    }

    return data;
  }
}

module.exports = new SeatsService();
