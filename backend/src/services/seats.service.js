const seatsRepository = require('../repositories/seats.repository');
const AppError = require('../utils/AppError');

/**
 * Seats Service
 * Business logic for seat maps and seating availability.
 */
class SeatsService {
  async getSeatsByEventId(eventId) {
    const data = await seatsRepository.findByEventId(eventId);
    if (!data) {
      throw new AppError('Event not found', 404);
    }
    return data;
  }
}

module.exports = new SeatsService();
