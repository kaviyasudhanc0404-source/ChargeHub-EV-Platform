const mongoose = require('mongoose');

// Gazetteer of populated places (GeoNames, CC BY 4.0): every Tamil Nadu village/town + larger towns across India.
// Loaded with `npm run import-places`; used for instant, rate-limit-free place search.
const placeSchema = new mongoose.Schema({
  geonameId: { type: Number, required: true, unique: true },
  name: { type: String, required: true },          // display name without accents, e.g. "Kugalur"
  names: { type: [String], index: true },          // normalized spellings used for prefix search
  district: String,
  state: String,
  inTamilNadu: { type: Boolean, default: false },
  population: { type: Number, default: 0 },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true }
}, { versionKey: false });

module.exports = mongoose.model('Place', placeSchema);
