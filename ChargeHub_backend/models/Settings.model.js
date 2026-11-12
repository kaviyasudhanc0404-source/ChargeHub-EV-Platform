const mongoose = require('mongoose');

// Single platform-wide settings document
const settingsSchema = new mongoose.Schema({
  userRegistration: { type: Boolean, default: true },
  providerRegistration: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  platformFeePercent: { type: Number, default: 10, min: 0, max: 50 }
}, { timestamps: true });

const CACHE_MS = 30 * 1000;
let cache = null;
let cachedAt = 0;

settingsSchema.statics.get = async function () {
  if (cache && Date.now() - cachedAt < CACHE_MS) return cache;
  cache = await this.findOneAndUpdate({}, {}, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  cachedAt = Date.now();
  return cache;
};

settingsSchema.statics.update = async function (changes) {
  cache = await this.findOneAndUpdate({}, changes, { upsert: true, new: true, runValidators: true }).lean();
  cachedAt = Date.now();
  return cache;
};

module.exports = mongoose.model('Settings', settingsSchema);
