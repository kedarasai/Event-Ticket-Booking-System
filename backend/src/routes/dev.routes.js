const express = require('express');
const devController = require('../controllers/dev.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * Dev-only race simulation endpoints.
 * Only mounted when NODE_ENV !== 'production'.
 */
router.post('/race', authenticate, devController.runRace);
router.post('/race/reset', authenticate, devController.resetRace);
router.get('/race/check', authenticate, devController.checkSeatLock);

module.exports = router;
