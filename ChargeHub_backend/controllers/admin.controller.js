const User = require('../models/User.model');
const Station = require('../models/Station.model');
const Booking = require('../models/Booking.model');
const Payment = require('../models/Payment.model');
const Report = require('../models/Report.model');
const Settings = require('../models/Settings.model');
const { escapeRegex } = require('../utils/text');
const { AppError, asyncHandler } = require('../middleware/error.middleware');
const { timeSeries, sumOf, startOfToday, startOfMonth, growth } = require('../utils/stats');

const PAID = { status: 'completed' };

const paginate = (req, defaultLimit = 100) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || defaultLimit, 200);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  return { limit, skip: (page - 1) * limit, page };
};

// @route   GET /api/admin/stats
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const [totalUsers, totalProviders, totalStations, pendingStations, totalBookings, activeBookings, completedBookings,
    todayBookings, revenue, todayRevenue, pendingReports] = await Promise.all([
    User.countDocuments({ role: 'user', isActive: true }),
    User.countDocuments({ role: 'provider', isActive: true }),
    Station.countDocuments({ isActive: true, isVerified: true }),
    Station.countDocuments({ isActive: true, isVerified: false }),
    Booking.countDocuments(),
    Booking.countDocuments({ status: 'confirmed', slotEnd: { $gte: new Date() } }),
    Booking.countDocuments({ status: 'completed' }),
    Booking.countDocuments({ createdAt: { $gte: startOfToday() } }),
    Payment.aggregate([{ $match: PAID }, { $group: { _id: null, gross: { $sum: '$amount' }, platform: { $sum: '$platformFee' } } }]),
    sumOf(Payment, { ...PAID, createdAt: { $gte: startOfToday() } }, 'platformFee'),
    Report.countDocuments({ status: 'pending' })
  ]);

  res.json({
    success: true,
    data: {
      totalUsers,
      totalProviders,
      totalStations,
      pendingStations,
      totalBookings,
      activeBookings,
      completedBookings,
      todayBookings,
      totalRevenue: Math.round(revenue[0]?.gross || 0),
      platformRevenue: Math.round(revenue[0]?.platform || 0),
      todayRevenue: todayRevenue.total,
      pendingReports
    }
  });
});

// @route   GET /api/admin/users?role=&search=&page=&limit=
exports.getUsers = asyncHandler(async (req, res) => {
  const { role, search } = req.query;
  const { limit, skip, page } = paginate(req);
  const filter = {};
  if (role) filter.role = role;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const [users, count] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter)
  ]);
  res.json({ success: true, count, page, pages: Math.ceil(count / limit), data: users });
});

// @route   PATCH /api/admin/users/:id/block
exports.blockUser = asyncHandler(async (req, res) => {
  if (req.params.id === String(req.user._id)) throw new AppError(400, 'You cannot block your own account');
  const isBlocked = Boolean(req.body.isBlocked);
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: !isBlocked }, { new: true });
  if (!user) throw new AppError(404, 'User not found');
  res.json({ success: true, message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`, data: user });
});

// @route   PATCH /api/admin/users/:id/approve
exports.approveUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isVerified: true, isActive: true }, { new: true });
  if (!user) throw new AppError(404, 'User not found');
  res.json({ success: true, message: 'User approved successfully', data: user });
});

// @route   DELETE /api/admin/users/:id   (a deleted provider's stations are taken offline)
exports.deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === String(req.user._id)) throw new AppError(400, 'You cannot delete your own account');
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new AppError(404, 'User not found');
  if (user.role === 'provider') await Station.updateMany({ providerId: user._id }, { isActive: false });
  res.json({ success: true, message: 'User deleted successfully' });
});

// @route   POST /api/admin/users/admin
exports.addAdmin = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.emailTaken(email)) throw new AppError(400, 'Email already registered');
  const admin = await User.create({ name, email, password, role: 'admin', isVerified: true });
  res.status(201).json({ success: true, message: 'Admin created successfully', data: admin.toAuthJSON() });
});

// @route   GET /api/admin/stations?isVerified=&page=&limit=
exports.getStations = asyncHandler(async (req, res) => {
  const { limit, skip, page } = paginate(req);
  const filter = { isActive: true };
  if (req.query.isVerified !== undefined) filter.isVerified = req.query.isVerified === 'true';

  const [stations, count] = await Promise.all([
    Station.find(filter).populate('providerId', 'name email phone').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Station.countDocuments(filter)
  ]);
  res.json({ success: true, count, page, pages: Math.ceil(count / limit), data: stations });
});

// @route   PATCH /api/admin/stations/:id/verify
exports.verifyStation = asyncHandler(async (req, res) => {
  const isVerified = Boolean(req.body.isVerified);
  const station = await Station.findByIdAndUpdate(req.params.id, { isVerified }, { new: true });
  if (!station) throw new AppError(404, 'Station not found');
  res.json({ success: true, message: `Station ${isVerified ? 'approved' : 'unapproved'} successfully`, data: station });
});

// @route   GET /api/admin/analytics
exports.getAnalytics = asyncHandler(async (req, res) => {
  const thisMonth = { $gte: startOfMonth() };
  const lastMonth = { $gte: startOfMonth(1), $lt: startOfMonth() };

  const [userGrowth, monthlyBookings, topProviders, chargerSplit, newUsers, prevUsers, newProviders, prevProviders,
    revenueNow, revenuePrev, liveStations, bookedHours] = await Promise.all([
    timeSeries(User, { role: 'user' }, { unit: 'month', periods: 6 }),
    timeSeries(Booking, {}, { unit: 'month', periods: 6 }),
    Booking.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: '$providerId', bookings: { $sum: 1 } } },
      { $sort: { bookings: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'provider' } },
      { $project: { _id: 0, bookings: 1, name: { $ifNull: [{ $arrayElemAt: ['$provider.name', 0] }, 'Deleted provider'] } } }
    ]),
    Station.aggregate([
      { $match: { isActive: true, isVerified: true } },
      { $group: { _id: { $cond: [{ $gte: ['$power', 50] }, 'DC Fast Chargers', 'AC Chargers'] }, value: { $sum: 1 } } },
      { $project: { _id: 0, name: '$_id', value: 1 } }
    ]),
    User.countDocuments({ role: 'user', createdAt: thisMonth }),
    User.countDocuments({ role: 'user', createdAt: lastMonth }),
    User.countDocuments({ role: 'provider', createdAt: thisMonth }),
    User.countDocuments({ role: 'provider', createdAt: lastMonth }),
    sumOf(Payment, { ...PAID, createdAt: thisMonth }, 'amount'),
    sumOf(Payment, { ...PAID, createdAt: lastMonth }, 'amount'),
    Station.countDocuments({ isActive: true, isVerified: true }),
    sumOf(Booking, { status: { $in: ['confirmed', 'completed'] }, slotStart: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, 'duration')
  ]);

  res.json({
    success: true,
    data: {
      userGrowth,
      monthlyBookings,
      topProviders,
      chargerSplit,
      insights: {
        userGrowth: growth(newUsers, prevUsers),
        providerGrowth: growth(newProviders, prevProviders),
        revenueGrowth: growth(revenueNow.total, revenuePrev.total),
        utilization: liveStations ? Math.round((bookedHours.total / (liveStations * 24 * 30)) * 100) : 0
      }
    }
  });
});

// @route   GET /api/admin/transactions?page=&limit=
exports.getTransactions = asyncHandler(async (req, res) => {
  const { limit, skip, page } = paginate(req, 50);
  const [totals, monthly, transactions, count] = await Promise.all([
    Payment.aggregate([{ $match: PAID }, { $group: { _id: null, gross: { $sum: '$amount' }, platform: { $sum: '$platformFee' }, count: { $sum: 1 } } }]),
    timeSeries(Payment, PAID, { unit: 'month', periods: 6, sumField: 'amount' }),
    Payment.find()
      .populate('userId', 'name email')
      .populate('providerId', 'name')
      .populate('bookingId', 'bookingId stationName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments()
  ]);

  res.json({
    success: true,
    count,
    page,
    pages: Math.ceil(count / limit),
    data: {
      totalRevenue: Math.round(totals[0]?.gross || 0),
      platformRevenue: Math.round(totals[0]?.platform || 0),
      completedPayments: totals[0]?.count || 0,
      monthly,
      transactions
    }
  });
});

// @route   GET /api/admin/settings
exports.getSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Settings.get() });
});

// @route   PUT /api/admin/settings
exports.updateSettings = asyncHandler(async (req, res) => {
  const changes = {};
  ['userRegistration', 'providerRegistration', 'maintenanceMode'].forEach((key) => {
    if (req.body[key] !== undefined) changes[key] = Boolean(req.body[key]);
  });
  if (req.body.platformFeePercent !== undefined) changes.platformFeePercent = Number(req.body.platformFeePercent);
  res.json({ success: true, message: 'Settings saved', data: await Settings.update(changes) });
});
