const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const Settings = require('../models/Settings.model');
const { AppError, asyncHandler } = require('./error.middleware');

// Verify the Bearer JWT and attach the user to the request
exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError(401, 'Not authorized to access this route');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError(401, 'Session expired. Please log in again.');
  }

  const user = await User.findById(decoded.id);
  if (!user) throw new AppError(401, 'User not found');
  if (!user.isActive) throw new AppError(403, 'Your account has been deactivated. Please contact support.');

  if (user.role !== 'admin' && (await Settings.get()).maintenanceMode) {
    throw new AppError(503, 'ChargeHub is under maintenance. Please try again later.');
  }

  req.user = user;
  next();
});

// Signed-in user when a token is sent, guest otherwise (an expired token still answers 401 so the app logs out)
exports.optionalAuth = (req, res, next) => (req.headers.authorization ? exports.protect(req, res, next) : next());

// Restrict a route to the given roles
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError(403, 'You are not allowed to access this route'));
  }
  next();
};

exports.generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRE || '7d'
});
