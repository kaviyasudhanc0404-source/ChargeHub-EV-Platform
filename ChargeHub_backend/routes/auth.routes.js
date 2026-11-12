const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { validate } = require('../middleware/validator.middleware');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Stricter limit for credential endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' }
});

const role = body('role').optional().isIn(['user', 'provider']).withMessage('Invalid role');

router.post('/register', authLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().toLowerCase().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  role
], validate, authController.register);

router.post('/login', authLimiter, [
  body('email').trim().isEmail().toLowerCase().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], validate, authController.login);

router.post('/google', authLimiter, [
  body('idToken').notEmpty().withMessage('Google sign-in token is required'),
  role
], validate, authController.googleAuth);

router.get('/me', protect, authController.getMe);
router.delete('/me', protect, authorize('user', 'provider'), authController.deleteMe);

router.put('/update-profile', protect, [
  body('email').optional().trim().isEmail().toLowerCase().withMessage('Valid email is required'),
  body('defaultCoordinates.lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid default location'),
  body('defaultCoordinates.lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid default location')
], validate, authController.updateProfile);

// Changing the password: the current one is confirmed first (rate-limited like login)
const currentPassword = body('currentPassword').isString().notEmpty().withMessage('Enter your current password');
router.post('/verify-password', protect, authLimiter, [currentPassword], validate, authController.verifyPassword);
router.put('/change-password', protect, authLimiter, [
  currentPassword,
  body('newPassword').isString().isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], validate, authController.changePassword);

module.exports = router;
