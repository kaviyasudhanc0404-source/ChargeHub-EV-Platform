const express = require('express');
const { body } = require('express-validator');
const adminController = require('../controllers/admin.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validator.middleware');

const router = express.Router();
router.use(protect, authorize('admin'));

router.get('/stats', adminController.getDashboardStats);
router.get('/analytics', adminController.getAnalytics);
router.get('/transactions', adminController.getTransactions);

router.get('/users', adminController.getUsers);
router.post('/users/admin', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().toLowerCase().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], validate, adminController.addAdmin);
router.patch('/users/:id/block', adminController.blockUser);
router.patch('/users/:id/approve', adminController.approveUser);
router.delete('/users/:id', adminController.deleteUser);

router.get('/stations', adminController.getStations);
router.patch('/stations/:id/verify', adminController.verifyStation);

router.get('/settings', adminController.getSettings);
router.put('/settings', [
  body('platformFeePercent').optional().isFloat({ min: 0, max: 50 }).withMessage('Platform fee must be between 0 and 50%')
], validate, adminController.updateSettings);

module.exports = router;
