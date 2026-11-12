const express = require('express');
const stationController = require('../controllers/station.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Public
router.get('/', stationController.getAllStations);
router.get('/stats', stationController.getPublicStats);
router.get('/nearby', stationController.getNearbyStations);

// Provider / Admin
router.use(protect, authorize('provider', 'admin'));
router.get('/mine', stationController.getMyStations);
router.post('/', stationController.createStation);
router.put('/:id', stationController.updateStation);
router.patch('/:id/availability', stationController.updateAvailability);
router.delete('/:id', stationController.deleteStation);

module.exports = router;
