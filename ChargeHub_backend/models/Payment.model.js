const mongoose = require('mongoose');

// One record per completed charging session (amount collected at the station)
const paymentSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    unique: true,
    required: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'card'],
    default: 'cash'
  },
  status: {
    type: String,
    enum: ['completed', 'refunded'],
    default: 'completed'
  },
  providerAmount: {
    type: Number,
    required: true // Provider's share after platform fee
  },
  platformFee: {
    type: Number,
    default: 0 // Commission owed to the platform
  }
}, {
  timestamps: true
});

paymentSchema.index({ providerId: 1, createdAt: -1 });
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

paymentSchema.pre('validate', function (next) {
  if (!this.transactionId) {
    this.transactionId = `TXN${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
