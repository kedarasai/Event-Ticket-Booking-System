const devService = require('../services/dev.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

/**
 * Dev Controller
 * Handles dev-only race test execution and reset requests.
 */
class DevController {
  runRace = asyncHandler(async (req, res) => {
    const data = await devService.runRace(req.body);
    return sendSuccess(res, 200, 'Race simulation completed', data);
  });

  resetRace = asyncHandler(async (req, res) => {
    const data = await devService.resetRace(req.body);
    return sendSuccess(res, 200, 'Race seat reset successfully', data);
  });

  checkSeatLock = asyncHandler(async (req, res) => {
    const seatId = req.query.seatId || req.params.seatId;
    const data = await devService.checkSeatLock(seatId);
    return sendSuccess(res, 200, 'Seat lock check completed', data);
  });
}

module.exports = new DevController();
