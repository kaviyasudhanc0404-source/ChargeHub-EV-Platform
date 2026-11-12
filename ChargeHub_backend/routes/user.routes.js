const express = require('express');
const userController = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/stats', protect, authorize('user'), userController.getStats);

module.exports = router;
