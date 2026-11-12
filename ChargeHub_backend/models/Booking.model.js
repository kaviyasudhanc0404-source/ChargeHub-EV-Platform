const mongoose = require('mongoose');

// Booking dates/times are entered in Indian Standard Time (UTC+05:30, no DST)
const IST_OFFSET_MS = 330 * 60 * 1000;
// A confirmed booking whose OTP is not verified by this long after its slot ends is marked as a no-show ("missed")
const NO_SHOW_GRACE_MS = 30 * 60 * 1000;
const missedBefore = () => new Date(Date.now() - NO_SHOW_GRACE_MS);

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    unique: true,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  stationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station',
    required: true
  },
  stationName: {
    type: String,
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vehicleInfo: {
    vehicleName: {
      type: String,
      required: true,
      trim: true
    },
    vehicleModel: String,
    vehicleType: {
      type: String,
      enum: ['car', 'bike']
    }
  },
  bookingDate: {
    type: Date,
    required: true
  },
  bookingTime: {
    type: String,
    required: true,
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Booking time must be HH:mm']
  },
  duration: {
    type: Number,
    required: true, // in hours
    min: 1,
    max: 8
  },
  // Reserved time window (UTC instants), derived from date + time + duration
  slotStart: Date,
  slotEnd: Date,
  pricing: {
    ratePerHour: {
      type: Number,
      required: true
    },
    totalCost: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR'
    }
  },
  status: {
    type: String,
    enum: ['confirmed', 'completed', 'cancelled', 'no-show'],
    default: 'confirmed'
  },
  // Paid at the station; becomes 'paid' when the provider verifies the session OTP
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null
  },
  completedAt: Date,
  energyConsumed: Number, // kWh
  rating: {
    stars: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String,
    ratedAt: Date
  },
  cancellationReason: String,
  cancelledAt: Date,
  cancelledBy: {
    type: String,
    enum: ['user', 'provider', 'admin']
  },
  otpHash: {
    type: String,
    select: false
  },
  otpExpiry: Date,
  otpSentAt: Date,
  otpAttempts: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

bookingSchema.index({ stationId: 1, slotStart: 1 });
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ providerId: 1, createdAt: -1 });
bookingSchema.index({ status: 1, slotEnd: 1 });

bookingSchema.statics.computeSlot = (bookingDate, bookingTime, duration) => {
  const date = new Date(bookingDate);
  const [hours, minutes] = bookingTime.split(':').map(Number);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes) - IST_OFFSET_MS;
  return { slotStart: new Date(start), slotEnd: new Date(start + duration * 60 * 60 * 1000) };
};

// Marks confirmed bookings whose slot has passed without a verified session as no-shows
bookingSchema.statics.expireStale = function () {
  return this.updateMany({ status: 'confirmed', slotEnd: { $lt: missedBefore() } }, { $set: { status: 'no-show' } });
};

// Bookings made before slots were stored have no slotStart/slotEnd, so they could never expire: fill them in
bookingSchema.statics.ensureSlots = async function () {
  const legacy = await this.find({ slotEnd: { $exists: false } }, 'bookingDate bookingTime duration').lean();
  if (!legacy.length) return;
  await this.bulkWrite(legacy.map(b => ({
    updateOne: { filter: { _id: b._id }, update: { $set: this.computeSlot(b.bookingDate, b.bookingTime, b.duration) } }
  })));
};

// The last moment this session can be verified: the end of the slot plus the grace period
bookingSchema.methods.verifyDeadline = function () {
  return new Date(this.slotEnd.getTime() + NO_SHOW_GRACE_MS);
};

// Confirmed, but the time to verify the session has run out
bookingSchema.methods.isMissed = function () {
  return this.status === 'confirmed' && this.verifyDeadline() < new Date();
};

bookingSchema.pre('validate', function (next) {
  if (!this.bookingId) {
    this.bookingId = `BK${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }
  if (this.isModified('bookingDate') || this.isModified('bookingTime') || this.isModified('duration')) {
    Object.assign(this, this.constructor.computeSlot(this.bookingDate, this.bookingTime, this.duration));
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
