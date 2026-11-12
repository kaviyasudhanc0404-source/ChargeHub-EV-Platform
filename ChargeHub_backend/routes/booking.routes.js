const express = require('express');
const { body, param } = require('express-validator');
const bookingController = require('../controllers/booking.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validator.middleware');

const router = express.Router();
router.use(protect);

// User
router.post('/', authorize('user'), [
  body('stationId').isMongoId().withMessage('Please select a station'),
  body('vehicleInfo.vehicleName').trim().notEmpty().withMessage('Vehicle name is required'),
  body('vehicleInfo.vehicleType').isIn(['car', 'bike']).withMessage('Vehicle type must be car or bike'),
  body('bookingDate').matches(/^\d{4}-\d{2}-\d{2}$/).isISO8601({ strict: true }).withMessage('Booking date must be YYYY-MM-DD'),
  body('bookingTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Booking time must be HH:mm'),
  body('duration').isInt({ min: 1, max: 8 }).withMessage('Duration must be between 1 and 8 hours')
], validate, bookingController.createBooking);
router.get('/availability/:stationId', authorize('user'), [
  param('stationId').isMongoId().withMessage('Please select a station')
], validate, bookingController.getAvailability);
router.get('/my-bookings', authorize('user'), bookingController.getMyBookings);
router.patch('/:id/cancel', authorize('user'), bookingController.cancelBooking);
router.post('/:id/rate', authorize('user'), [
  body('stars').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1 to 5 stars'),
  body('review').optional().isString().isLength({ max: 500 }).withMessage('Review is too long')
], validate, bookingController.rateBooking);

// Provider (admin can act on any booking)
router.get('/provider', authorize('provider'), bookingController.getProviderBookings);
router.post('/:id/otp', authorize('provider', 'admin'), bookingController.generateOTP);
router.post('/:id/verify', authorize('provider', 'admin'), [
  body('otp').matches(/^\d{6}$/).withMessage('OTP must be 6 digits'),
  body('energyConsumed').optional({ values: 'falsy' }).isFloat({ min: 0, max: 1000 }).withMessage('Invalid energy value')
], validate, bookingController.verifyOTP);
router.delete('/:id', authorize('provider', 'admin'), bookingController.deleteBooking);

module.exports = router;
