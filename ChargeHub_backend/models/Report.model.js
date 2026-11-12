const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reporterName: { type: String, required: true },
  reporterRole: { type: String, enum: ['user', 'provider'], required: true },
  category: {
    type: String,
    enum: ['station', 'booking', 'payment', 'account', 'other'],
    default: 'other'
  },
  subject: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', default: null },
  status: { type: String, enum: ['pending', 'resolved'], default: 'pending' },
  adminNote: { type: String, trim: true, maxlength: 1000 },
  resolvedAt: Date
}, { timestamps: true });

reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
