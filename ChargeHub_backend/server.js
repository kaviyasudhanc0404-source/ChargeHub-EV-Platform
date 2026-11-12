const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
require('dotenv').config();
// Stop here with a clear message if a required setting is missing
try {
  require('./config/env')();
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
const connectDB = require('./config/db');
const Booking = require('./models/Booking.model');
const User = require('./models/User.model');
const Station = require('./models/Station.model');
const { protect, optionalAuth } = require('./middleware/auth.middleware');
const { notFound, errorHandler } = require('./middleware/error.middleware');
const geocode = require('./controllers/geocode.controller');
const { getNotifications } = require('./controllers/notification.controller');
const { chat } = require('./controllers/chat.controller');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
// Browsers send the origin without a trailing slash, so "https://app.vercel.app/" in FRONTEND_URL must still match
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:8080')
  .split(',')
  .map(origin => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

// Behind a hosting proxy (Render, Railway, …) so rate limits see the real client IP
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(compression());

// Health check for the host (Render polls it): registered before logging and rate limiting so frequent checks
// neither flood the logs nor get throttled; 503 while the database is unreachable
app.get('/api/health', (req, res) => {
  const database = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(database === 'connected' ? 200 : 503).json({ status: database === 'connected' ? 'OK' : 'DEGRADED', database, timestamp: new Date().toISOString() });
});

app.use('/api/chat', express.json({ limit: '6mb' })); // chat messages may include an image
app.use(express.json({ limit: '100kb' }));
app.use(morgan(isProduction ? 'combined' : 'dev'));

const limiter = (limit) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' }
});
app.use('/api/', limiter(300));

// API Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/providers', require('./routes/provider.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/stations', require('./routes/station.routes'));
app.use('/api/bookings', require('./routes/booking.routes'));
app.use('/api/reports', require('./routes/report.routes'));
app.get('/api/geocode/search', limiter(150), geocode.search);
app.get('/api/geocode/reverse', limiter(150), geocode.reverse);
app.get('/api/geocode/check-pin', limiter(150), geocode.checkPin);
app.get('/api/notifications', protect, getNotifications);
app.post('/api/chat', limiter(40), optionalAuth, chat); // open to guests; live-data answers need a sign-in

app.use(notFound);
app.use(errorHandler);

// Start only after the database is reachable
const PORT = process.env.PORT || 5000;
const EXPIRY_INTERVAL_MS = 10 * 60 * 1000;
const SHUTDOWN_TIMEOUT_MS = 10 * 1000;

const expireStaleBookings = () => Booking.expireStale().catch(err => console.error('Booking expiry failed:', err.message));

connectDB()
  .then(() => {
    User.ensureEmailKeys().catch(err => console.error('User email key backfill failed:', err.message));
    Booking.ensureSlots()
      .catch(err => console.error('Booking slot backfill failed:', err.message))
      .then(expireStaleBookings);
    Station.ensureGeoPoints().catch(err => console.error('Station geo backfill failed:', err.message));
    setInterval(expireStaleBookings, EXPIRY_INTERVAL_MS).unref();
    const server = app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`));

    // Hosts send SIGTERM before every redeploy/restart: finish in-flight requests, then close the database cleanly
    const shutdown = (signal) => {
      console.log(`${signal} received, shutting down`);
      setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref(); // don't hang on long-lived connections
      server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  });

module.exports = app;
