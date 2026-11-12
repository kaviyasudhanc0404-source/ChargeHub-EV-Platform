const Station = require('../models/Station.model');
const Booking = require('../models/Booking.model');
const Payment = require('../models/Payment.model');
const { asyncHandler } = require('../middleware/error.middleware');
const { timeSeries, sumOf, startOfMonth } = require('../utils/stats');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_SLOTS = [
  { name: 'Night (0-6)', from: 0, to: 6 },
  { name: 'Morning (6-12)', from: 6, to: 12 },
  { name: 'Afternoon (12-18)', from: 12, to: 18 },
  { name: 'Evening (18-24)', from: 18, to: 24 }
];

// @route   GET /api/providers/stats   (dashboard, earnings and profile figures)
exports.getStats = asyncHandler(async (req, res) => {
  const providerId = req.user._id;
  const paid = { providerId, status: 'completed' };

  const [stationCounts, completed, bookingsThisMonth, upcoming, earnings, thisMonth, daily, monthly, recentBookings, payments] = await Promise.all([
    Station.aggregate([
      { $match: { providerId, isActive: true } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: ['$isVerified', 0, 1] } },
          online: { $sum: { $cond: [{ $and: ['$isVerified', '$availability.isAvailable'] }, 1, 0] } }
        }
      }
    ]),
    Booking.countDocuments({ providerId, status: 'completed' }),
    Booking.countDocuments({ providerId, createdAt: { $gte: startOfMonth() } }),
    Booking.countDocuments({ providerId, status: 'confirmed', slotEnd: { $gte: new Date() } }),
    Payment.aggregate([
      { $match: paid },
      { $group: { _id: null, gross: { $sum: '$amount' }, net: { $sum: '$providerAmount' }, platformFee: { $sum: '$platformFee' } } }
    ]),
    sumOf(Payment, { ...paid, createdAt: { $gte: startOfMonth() } }, 'amount'),
    timeSeries(Payment, paid, { unit: 'day', periods: 7, sumField: 'amount' }),
    timeSeries(Payment, paid, { unit: 'month', periods: 6, sumField: 'amount' }),
    Booking.find({ providerId }).sort({ createdAt: -1 }).limit(5).populate('userId', 'name').lean(),
    Payment.find(paid).sort({ createdAt: -1 }).limit(20).populate('bookingId', 'bookingId stationName').lean()
  ]);

  const stations = stationCounts[0] || { total: 0, pending: 0, online: 0 };
  const totals = earnings[0] || { gross: 0, net: 0, platformFee: 0 };

  res.json({
    success: true,
    data: {
      totalStations: stations.total,
      pendingStations: stations.pending,
      onlineStations: stations.online,
      completedBookings: completed,
      bookingsThisMonth,
      upcomingBookings: upcoming,
      earnings: {
        gross: Math.round(totals.gross),
        net: Math.round(totals.net),
        platformFee: Math.round(totals.platformFee),
        thisMonth: thisMonth.total
      },
      daily,
      monthly,
      recentBookings,
      payments
    }
  });
});

// @route   GET /api/providers/analytics
exports.getAnalytics = asyncHandler(async (req, res) => {
  const providerId = req.user._id;
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [monthlyBookings, statusCounts, hourBuckets, byWeekday, stations, bookedHours] = await Promise.all([
    timeSeries(Booking, { providerId }, { unit: 'month', periods: 6 }),
    Booking.aggregate([{ $match: { providerId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.aggregate([
      { $match: { providerId, status: { $ne: 'cancelled' } } },
      { $group: { _id: { $toInt: { $substrBytes: ['$bookingTime', 0, 2] } }, count: { $sum: 1 } } }
    ]),
    Payment.aggregate([
      { $match: { providerId, status: 'completed' } },
      { $group: { _id: { $dayOfWeek: { date: '$createdAt', timezone: 'Asia/Kolkata' } }, total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 1 }
    ]),
    Station.find({ providerId, isActive: true }).select('name totalBookings totalRevenue rating isVerified').lean(),
    sumOf(Booking, { providerId, status: { $in: ['confirmed', 'completed'] }, slotStart: { $gte: last30Days } }, 'duration')
  ]);

  const byStatus = Object.fromEntries(statusCounts.map(s => [s._id, s.count]));
  const totalBookings = statusCounts.reduce((sum, s) => sum + s.count, 0);
  const usage = TIME_SLOTS.map(slot => ({
    name: slot.name,
    value: hourBuckets.filter(h => h._id >= slot.from && h._id < slot.to).reduce((sum, h) => sum + h.count, 0)
  }));
  const rated = stations.filter(s => s.rating?.count);
  const ratingCount = rated.reduce((sum, s) => sum + s.rating.count, 0);
  const averageRating = ratingCount
    ? Math.round((rated.reduce((sum, s) => sum + s.rating.average * s.rating.count, 0) / ratingCount) * 10) / 10
    : null;
  const liveStations = stations.filter(s => s.isVerified).length;
  const mostBooked = [...stations].sort((a, b) => b.totalBookings - a.totalBookings)[0];

  res.json({
    success: true,
    data: {
      monthlyBookings,
      usage,
      totalBookings,
      completionRate: totalBookings ? Math.round(((byStatus.completed || 0) / totalBookings) * 100) : 0,
      cancellationRate: totalBookings ? Math.round(((byStatus.cancelled || 0) / totalBookings) * 100) : 0,
      utilization: liveStations ? Math.round((bookedHours.total / (liveStations * 24 * 30)) * 100) : 0,
      averageRating,
      mostBookedStation: mostBooked?.totalBookings ? mostBooked.name : null,
      topEarningDay: byWeekday[0] ? DAYS[byWeekday[0]._id - 1] : null,
      stations: stations.map(s => ({
        name: s.name,
        bookings: s.totalBookings,
        revenue: s.totalRevenue,
        rating: s.rating?.average || 0,
        approved: s.isVerified
      }))
    }
  });
});
