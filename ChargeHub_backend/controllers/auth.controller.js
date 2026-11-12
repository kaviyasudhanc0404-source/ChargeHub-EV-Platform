const crypto = require('crypto');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const User = require('../models/User.model');
const Station = require('../models/Station.model');
const Booking = require('../models/Booking.model');
const Settings = require('../models/Settings.model');
const { generateToken } = require('../middleware/auth.middleware');
const { AppError, asyncHandler } = require('../middleware/error.middleware');

// Verifies Firebase ID tokens using Google's public keys (no service account needed)
const firebaseAuth = getAuth(initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID }));

const assertRegistrationOpen = async (role) => {
  const settings = await Settings.get();
  const open = role === 'provider' ? settings.providerRegistration : settings.userRegistration;
  if (!open) throw new AppError(403, `New ${role} registrations are currently closed`);
};

const sendAuth = (res, status, user, message) => {
  res.status(status).json({
    success: true,
    message,
    data: { user: user.toAuthJSON(), token: generateToken(user._id) }
  });
};

// @route   POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, businessInfo } = req.body;
  const role = req.body.role || 'user';
  await assertRegistrationOpen(role);

  if (await User.emailTaken(email)) throw new AppError(400, 'User already exists with this email');

  const user = await User.create({
    name,
    email,
    password,
    role,
    phone,
    businessInfo: role === 'provider' ? { location: businessInfo?.location, upiId: businessInfo?.upiId } : undefined
  });
  sendAuth(res, 201, user, 'Registration successful');
});

// @route   POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findByEmail(email).select('+password');
  if (!user || !(await user.comparePassword(password))) throw new AppError(401, 'Invalid email or password');
  if (!user.isActive) throw new AppError(403, 'Your account has been deactivated. Please contact support.');

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });
  sendAuth(res, 200, user, 'Login successful');
});

// @route   POST /api/auth/google   (Firebase Google sign-in)
exports.googleAuth = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  const role = req.body.role || 'user';

  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(idToken);
  } catch {
    throw new AppError(401, 'Google sign-in failed. Please try again.');
  }
  if (!decoded.email || !decoded.email_verified) throw new AppError(401, 'Your Google email address is not verified');

  const email = decoded.email.trim().toLowerCase();
  const googleId = decoded.firebase?.identities?.['google.com']?.[0] || decoded.uid;
  // By Google account first, so it still signs in after the user changes their email in the app
  let user = (await User.findOne({ googleId })) || (await User.findByEmail(email));

  if (user) {
    if (!user.isActive) throw new AppError(403, 'Your account has been deactivated. Please contact support.');
    user.googleId = user.googleId || googleId;
    user.profilePicture = user.profilePicture || decoded.picture;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    return sendAuth(res, 200, user, 'Login successful');
  }

  await assertRegistrationOpen(role);
  user = await User.create({
    name: decoded.name || email.split('@')[0],
    email,
    googleId,
    profilePicture: decoded.picture,
    role,
    isVerified: true,
    password: crypto.randomBytes(24).toString('hex'), // unusable password; account signs in with Google
    hasPassword: false,
    lastLogin: new Date()
  });
  sendAuth(res, 201, user, 'Registration successful');
});

// @route   GET /api/auth/me
exports.getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

// @route   PUT /api/auth/update-profile
exports.updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  const { name, email, phone, vehicleInfo, defaultLocation, defaultCoordinates, businessInfo } = req.body;

  if (name !== undefined) user.name = name;
  if (email !== undefined && email !== user.email) {
    if (await User.emailTaken(email, user._id)) throw new AppError(409, 'This email is already used by another account');
    user.email = email;
  }
  if (phone !== undefined) user.phone = phone;
  if (vehicleInfo !== undefined) user.vehicleInfo = vehicleInfo;
  if (defaultLocation !== undefined) {
    user.defaultLocation = defaultLocation;
    // A typed name without a point is resolved again by search; a picked place keeps its exact point
    user.defaultCoordinates = defaultCoordinates || undefined;
  }
  if (businessInfo !== undefined && user.role === 'provider') user.businessInfo = businessInfo;

  await user.save();
  res.json({ success: true, message: 'Profile updated successfully', data: user });
});

// The signed-in user (with password hash) once `currentPassword` is confirmed. 400, not 401: a wrong password here
// must not end the session.
const confirmCurrentPassword = async (req) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!user.hasPassword) throw new AppError(400, 'You sign in with Google, so this account has no password to change');
  if (!(await user.comparePassword(req.body.currentPassword))) throw new AppError(400, 'Current password is incorrect', 'CURRENT_PASSWORD');
  return user;
};

// @route   POST /api/auth/verify-password   (step 1 of changing the password)
exports.verifyPassword = asyncHandler(async (req, res) => {
  await confirmCurrentPassword(req);
  res.json({ success: true, message: 'Password confirmed' });
});

// @route   PUT /api/auth/change-password   (checks the current password again, so it cannot be skipped)
exports.changePassword = asyncHandler(async (req, res) => {
  const user = await confirmCurrentPassword(req);
  if (await user.comparePassword(req.body.newPassword)) throw new AppError(400, 'The new password must be different from the current one');
  user.password = req.body.newPassword;
  await user.save();
  res.json({ success: true, message: 'Password changed successfully' });
});

// @route   DELETE /api/auth/me   (user/provider closes their own account)
exports.deleteMe = asyncHandler(async (req, res) => {
  const { _id, role } = req.user;
  const owner = role === 'provider' ? 'providerId' : 'userId';
  await Booking.updateMany(
    { [owner]: _id, status: 'confirmed' },
    { status: 'cancelled', cancelledAt: new Date(), cancelledBy: role, cancellationReason: 'Account deleted' }
  );
  if (role === 'provider') await Station.updateMany({ providerId: _id }, { isActive: false });
  await User.deleteOne({ _id });
  res.json({ success: true, message: 'Your account has been deleted' });
});
