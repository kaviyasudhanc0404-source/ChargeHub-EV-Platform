const express = require('express');
const { body } = require('express-validator');
const reportController = require('../controllers/report.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validator.middleware');

const router = express.Router();
router.use(protect);

router.post('/', authorize('user', 'provider'), [
  body('category').optional().isIn(['station', 'booking', 'payment', 'account', 'other']).withMessage('Invalid category'),
  body('subject').trim().isLength({ min: 3, max: 120 }).withMessage('Subject must be 3–120 characters'),
  body('message').trim().isLength({ min: 10, max: 2000 }).withMessage('Please describe the issue in at least 10 characters'),
  body('stationId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid station')
], validate, reportController.createReport);

router.use(authorize('admin'));
router.get('/', reportController.getReports);
router.patch('/:id/resolve', [
  body('adminNote').optional().isString().isLength({ max: 1000 }).withMessage('Note is too long')
], validate, reportController.resolveReport);
router.delete('/:id', reportController.deleteReport);

module.exports = router;
