const Booking = require('../models/Booking.model');
const Payment = require('../models/Payment.model');
const { asyncHandler } = require('../middleware/error.middleware');
const { timeSeries, sumOf, startOfMonth } = require('../utils/stats');

// @route   GET /api/users/stats   (dashboard + payment history for the logged-in user)
exports.getStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const paid = { userId, status: 'completed' };

  const [upcoming, spent, spentThisMonth, hoursThisMonth, monthly, payments] = await Promise.all([
    Booking.find({ userId, status: 'confirmed', slotEnd: { $gte: new Date() } })
      .sort({ slotStart: 1 })
      .select('bookingId stationName bookingDate bookingTime duration slotStart pricing')
      .lean(),
    sumOf(Payment, paid, 'amount'),
    sumOf(Payment, { ...paid, createdAt: { $gte: startOfMonth() } }, 'amount'),
    sumOf(Booking, { userId, status: 'completed', completedAt: { $gte: startOfMonth() } }, 'duration'),
    timeSeries(Payment, paid, { unit: 'month', periods: 6, sumField: 'amount' }),
    Payment.find(paid)
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('bookingId', 'bookingId stationName vehicleInfo duration bookingDate')
      .lean()
  ]);

  res.json({
    success: true,
    data: {
      upcomingBookings: upcoming.length,
      totalSpent: spent.total,
      totalCharges: spent.count,
      spentThisMonth: spentThisMonth.total,
      hoursThisMonth: hoursThisMonth.total,
      monthly,
      upcoming: upcoming.slice(0, 3),
      payments
    }
  });
});
