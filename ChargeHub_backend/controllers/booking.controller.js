const crypto = require('crypto');
const Booking = require('../models/Booking.model');
const Station = require('../models/Station.model');
const Payment = require('../models/Payment.model');
const Settings = require('../models/Settings.model');
const { sendOTPEmail } = require('../services/email.service');
const { overlapFilter, slotRule, availability } = require('../services/bookingSlots.service');
const { istClock } = require('../utils/time');
const { AppError, asyncHandler } = require('../middleware/error.middleware');

const OTP_MAX_ATTEMPTS = 5;
const OTP_EARLY_MS = 30 * 60 * 1000; // provider can start verification 30 min before the slot
const OTP_RESEND_MS = 30 * 1000; // a new code can be sent this long after the last one

const hashOtp = (bookingId, otp) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${bookingId}:${otp}`).digest('hex');

const findBookingFor = async (req, ownerField, select = '') => {
  const booking = await Booking.findById(req.params.id).select(select);
  if (!booking) throw new AppError(404, 'Booking not found');
  if (req.user.role !== 'admin' && !booking[ownerField].equals(req.user._id)) {
    throw new AppError(403, 'Not authorized to access this booking');
  }
  return booking;
};

const listLimit = (req) => Math.min(parseInt(req.query.limit, 10) || 50, 100);

// The code the customer currently holds, so the provider's app can go straight to entering it: { expiresAt, resendAt }.
// A code works until the session's verification deadline (the slot end plus the grace period).
const otpState = ({ otpExpiry, otpSentAt }) => (otpExpiry > new Date()
  ? { expiresAt: otpExpiry, resendAt: new Date((otpSentAt?.getTime() || 0) + OTP_RESEND_MS) }
  : null);

// A session can only be verified while its window is open; a booking found past it is closed as missed right away
const assertNotMissed = async (booking) => {
  if (!booking.isMissed()) return;
  booking.status = 'no-show';
  await booking.save();
  throw new AppError(400, 'The time to verify this session has passed, so the booking was marked as missed.');
};

// @route   POST /api/bookings
exports.createBooking = asyncHandler(async (req, res) => {
  const { stationId, vehicleInfo, bookingDate, bookingTime } = req.body;
  const duration = Number(req.body.duration);

  const station = await Station.findOne({ _id: stationId, isActive: true, isVerified: true });
  if (!station) throw new AppError(404, 'Station not found');
  if (!station.availability.isAvailable) throw new AppError(400, 'This station is currently offline');
  if (station.vehicleType !== 'both' && station.vehicleType !== vehicleInfo.vehicleType) {
    throw new AppError(400, `This station only supports ${station.vehicleType}s`);
  }

  const { slotStart, slotEnd } = Booking.computeSlot(bookingDate, bookingTime, duration);
  const problem = slotRule(station, { slotStart, bookingTime, duration });
  if (problem) throw new AppError(400, problem.message);

  if (await Booking.exists(overlapFilter(station._id, slotStart, slotEnd))) {
    throw new AppError(409, 'This time slot is already booked. Please choose another time.');
  }

  const booking = await Booking.create({
    userId: req.user._id,
    userName: req.user.name,
    stationId: station._id,
    stationName: station.name,
    providerId: station.providerId,
    vehicleInfo: { vehicleName: vehicleInfo.vehicleName, vehicleType: vehicleInfo.vehicleType },
    bookingDate,
    bookingTime,
    duration,
    pricing: { ratePerHour: station.pricing.ratePerHour, totalCost: station.pricing.ratePerHour * duration }
  });

  // Guard against two requests booking the same slot at the same moment: the earliest one wins
  const winner = await Booking.findOne(overlapFilter(station._id, slotStart, slotEnd)).sort({ createdAt: 1, _id: 1 });
  if (!winner._id.equals(booking._id)) {
    await booking.deleteOne();
    throw new AppError(409, 'This time slot was just booked by someone else. Please choose another time.');
  }

  await Station.updateOne({ _id: station._id }, { $inc: { totalBookings: 1 } });
  res.status(201).json({ success: true, message: 'Booking confirmed. Pay at the station.', data: booking });
});

// @route   GET /api/bookings/availability/:stationId?duration=2   (start times for the booking picker)
exports.getAvailability = asyncHandler(async (req, res) => {
  const duration = Number(req.query.duration);
  if (!Number.isInteger(duration) || duration < 1 || duration > 8) throw new AppError(400, 'Duration must be between 1 and 8 hours');
  const station = await Station.findOne({ _id: req.params.stationId, isActive: true, isVerified: true });
  if (!station) throw new AppError(404, 'Station not found');
  res.json({ success: true, data: await availability(station, duration) });
});

// @route   GET /api/bookings/my-bookings
exports.getMyBookings = asyncHandler(async (req, res) => {
  await Booking.expireStale(); // lists never show a missed booking as upcoming
  const bookings = await Booking.find({ userId: req.user._id })
    .populate('stationId', 'name location chargerType')
    .sort({ slotStart: -1 })
    .limit(listLimit(req))
    .lean();
  res.json({ success: true, count: bookings.length, data: bookings });
});

// @route   GET /api/bookings/provider
exports.getProviderBookings = asyncHandler(async (req, res) => {
  await Booking.expireStale();
  const bookings = await Booking.find({ providerId: req.user._id })
    .populate('stationId', 'name location')
    .populate('userId', 'name phone')
    .sort({ slotStart: -1 })
    .limit(listLimit(req))
    .lean();
  const data = bookings.map(({ otpExpiry, otpSentAt, otpAttempts, ...booking }) => ({ ...booking, otp: otpState({ otpExpiry, otpSentAt }) }));
  res.json({ success: true, count: data.length, data });
});

// @route   PATCH /api/bookings/:id/cancel
exports.cancelBooking = asyncHandler(async (req, res) => {
  const booking = await findBookingFor(req, 'userId');
  if (booking.status !== 'confirmed') throw new AppError(400, 'Only upcoming bookings can be cancelled');
  if (booking.slotStart <= new Date()) throw new AppError(400, 'This booking has already started');

  booking.status = 'cancelled';
  booking.cancellationReason = req.body.reason || 'Cancelled by user';
  booking.cancelledAt = new Date();
  booking.cancelledBy = 'user';
  await booking.save();
  res.json({ success: true, message: 'Booking cancelled successfully', data: booking });
});

// @route   POST /api/bookings/:id/rate
exports.rateBooking = asyncHandler(async (req, res) => {
  const booking = await findBookingFor(req, 'userId');
  if (booking.status !== 'completed') throw new AppError(400, 'Only completed bookings can be rated');
  if (booking.rating?.stars) throw new AppError(400, 'You have already rated this booking');

  const stars = Number(req.body.stars);
  booking.rating = { stars, review: req.body.review, ratedAt: new Date() };
  await booking.save();

  const station = await Station.findById(booking.stationId);
  if (station) {
    const count = station.rating.count + 1;
    station.rating.average = Math.round(((station.rating.average * station.rating.count + stars) / count) * 10) / 10;
    station.rating.count = count;
    await station.save();
  }
  res.json({ success: true, message: 'Thanks for rating your session!', data: booking });
});

// @route   DELETE /api/bookings/:id   (remove from provider/admin history)
exports.deleteBooking = asyncHandler(async (req, res) => {
  const booking = await findBookingFor(req, 'providerId');
  if (booking.status === 'confirmed') throw new AppError(400, 'Upcoming bookings cannot be deleted');
  await booking.deleteOne();
  res.json({ success: true, message: 'Booking deleted successfully' });
});

// @route   POST /api/bookings/:id/otp   (provider sends a check-in OTP to the user's email)
exports.generateOTP = asyncHandler(async (req, res) => {
  const booking = await findBookingFor(req, 'providerId');
  await booking.populate([{ path: 'userId', select: 'name email' }, { path: 'stationId', select: 'name' }]);

  if (booking.status !== 'confirmed') throw new AppError(400, 'OTP can only be sent for upcoming bookings');
  await assertNotMissed(booking);
  if (Date.now() < booking.slotStart.getTime() - OTP_EARLY_MS) {
    throw new AppError(400, 'OTP can be sent from 30 minutes before the booked slot');
  }

  const current = otpState(booking);
  if (current && current.resendAt > new Date()) {
    throw new AppError(429, `A code was just sent. You can send a new one in ${Math.ceil((current.resendAt - Date.now()) / 1000)} s.`);
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  booking.otpHash = hashOtp(booking._id, otp);
  booking.otpSentAt = new Date();
  booking.otpExpiry = booking.verifyDeadline();
  booking.otpAttempts = 0;
  await booking.save();

  const maskedEmail = booking.userId.email.replace(/(.{2}).*(@.*)/, '$1***$2');
  try {
    await sendOTPEmail(booking.userId.email, otp, booking.userId.name, booking.stationId?.name || booking.stationName, istClock(booking.otpExpiry));
  } catch (err) {
    console.error('OTP email failed:', err.message);
    if (process.env.NODE_ENV !== 'development') {
      // Nobody received this code, so don't leave it waiting to be entered
      booking.otpHash = undefined;
      booking.otpExpiry = undefined;
      booking.otpSentAt = undefined;
      await booking.save();
      throw new AppError(502, 'Could not send the OTP email. Please try again.');
    }
    // Development only: return the OTP so the flow can be tested without email
    return res.json({ success: true, message: 'Email unavailable – OTP returned for development', data: { ...otpState(booking), otp } });
  }

  res.json({ success: true, message: `OTP sent to ${maskedEmail}`, data: otpState(booking) });
});

// @route   POST /api/bookings/:id/verify   (provider verifies OTP → session completed, payment recorded)
exports.verifyOTP = asyncHandler(async (req, res) => {
  const booking = await findBookingFor(req, 'providerId', '+otpHash');
  if (booking.status !== 'confirmed') throw new AppError(400, 'This booking is not awaiting verification');
  await assertNotMissed(booking);
  if (!booking.otpHash || booking.otpExpiry < new Date()) throw new AppError(400, 'OTP has expired. Please send a new OTP.');
  if (booking.otpAttempts >= OTP_MAX_ATTEMPTS) throw new AppError(429, 'Too many incorrect attempts. Please send a new OTP.');

  const expected = Buffer.from(booking.otpHash, 'hex');
  const received = Buffer.from(hashOtp(booking._id, String(req.body.otp)), 'hex');
  if (!crypto.timingSafeEqual(expected, received)) {
    booking.otpAttempts += 1;
    await booking.save();
    throw new AppError(400, `Invalid OTP. ${OTP_MAX_ATTEMPTS - booking.otpAttempts} attempt(s) left.`);
  }

  const { platformFeePercent } = await Settings.get();
  const amount = booking.pricing.totalCost;
  const platformFee = Math.round(amount * platformFeePercent) / 100;
  const payment = await Payment.create({
    bookingId: booking._id,
    userId: booking.userId,
    providerId: booking.providerId,
    amount,
    providerAmount: amount - platformFee,
    platformFee
  });

  booking.set({
    status: 'completed',
    paymentStatus: 'paid',
    paymentId: payment._id,
    completedAt: new Date(),
    energyConsumed: Number(req.body.energyConsumed) || undefined,
    otpHash: undefined,
    otpExpiry: undefined,
    otpSentAt: undefined,
    otpAttempts: 0
  });
  await booking.save();
  await Station.updateOne({ _id: booking.stationId }, { $inc: { totalRevenue: amount } });

  res.json({ success: true, message: 'Charging session verified. Collect payment at the station.', data: booking });
});
