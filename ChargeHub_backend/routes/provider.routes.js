const express = require('express');
const providerController = require('../controllers/provider.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(protect, authorize('provider'));

router.get('/stats', providerController.getStats);
router.get('/analytics', providerController.getAnalytics);

module.exports = router;
