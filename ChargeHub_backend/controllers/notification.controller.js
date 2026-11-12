const Booking = require('../models/Booking.model');
const Station = require('../models/Station.model');
const Report = require('../models/Report.model');
const User = require('../models/User.model');
const { asyncHandler } = require('../middleware/error.middleware');

const DAY_MS = 24 * 60 * 60 * 1000;

const formatSlot = (date) => date.toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
});

const upcomingBookings = (match) => Booking.find({
  ...match,
  status: 'confirmed',
  slotStart: { $gte: new Date(), $lte: new Date(Date.now() + DAY_MS) }
}).sort({ slotStart: 1 }).limit(5).lean();

const resolvedReports = (reporterId) => Report.find({
  reporterId,
  status: 'resolved',
  resolvedAt: { $gte: new Date(Date.now() - 7 * DAY_MS) }
}).sort({ resolvedAt: -1 }).limit(3).lean();

const reportNotifications = (reports) => reports.map(r => ({
  id: `report-${r._id}`,
  message: `Your report "${r.subject}" was resolved${r.adminNote ? `: ${r.adminNote}` : ''}`,
  time: r.resolvedAt
}));

// Notifications are derived from live data, so they never go stale
const builders = {
  user: async (user) => {
    const [bookings, reports] = await Promise.all([upcomingBookings({ userId: user._id }), resolvedReports(user._id)]);
    return [
      ...bookings.map(b => ({
        id: `booking-${b._id}`,
        message: `Your booking at ${b.stationName} starts ${formatSlot(b.slotStart)}`,
        time: b.slotStart,
        link: '/user/bookings'
      })),
      ...reportNotifications(reports)
    ];
  },
  provider: async (user) => {
    const [bookings, pending, reports] = await Promise.all([
      upcomingBookings({ providerId: user._id }),
      Station.countDocuments({ providerId: user._id, isActive: true, isVerified: false }),
      resolvedReports(user._id)
    ]);
    return [
      ...bookings.map(b => ({
        id: `booking-${b._id}`,
        message: `${b.userName} booked ${b.stationName} for ${formatSlot(b.slotStart)}`,
        time: b.slotStart,
        link: '/provider/bookings'
      })),
      ...(pending ? [{ id: 'pending-stations', message: `${pending} station(s) awaiting admin approval`, link: '/provider/chargers' }] : []),
      ...reportNotifications(reports)
    ];
  },
  admin: async () => {
    const [stations, reports, providers] = await Promise.all([
      Station.countDocuments({ isActive: true, isVerified: false }),
      Report.countDocuments({ status: 'pending' }),
      User.countDocuments({ role: 'provider', isVerified: false })
    ]);
    return [
      stations && { id: 'stations', message: `${stations} station(s) waiting for approval`, link: '/admin/stations' },
      providers && { id: 'providers', message: `${providers} provider(s) waiting for approval`, link: '/admin/providers' },
      reports && { id: 'reports', message: `${reports} report(s) need attention`, link: '/admin/reports' }
    ].filter(Boolean);
  }
};

// @route   GET /api/notifications
exports.getNotifications = asyncHandler(async (req, res) => {
  const data = await builders[req.user.role](req.user);
  res.json({ success: true, data });
});
