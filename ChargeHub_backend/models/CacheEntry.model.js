const mongoose = require('mongoose');

// Key/value cache for external API results (place search, road distances); MongoDB removes expired entries
const cacheEntrySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true }
}, { versionKey: false });

cacheEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('CacheEntry', cacheEntrySchema);
