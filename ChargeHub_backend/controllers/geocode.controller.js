const { search, reverse } = require('../services/geocoding.service');
const { checkPin } = require('../services/stationPin.service');
const { readPoint } = require('../utils/geo');
const { AppError, asyncHandler } = require('../middleware/error.middleware');

// @route   GET /api/geocode/search?q=&lat=&lng=   (suggestions anywhere in India, biased near lat/lng)
exports.search = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await search(req.query.q, readPoint(req.query, false)) });
});

// @route   GET /api/geocode/reverse?lat=&lng=&area=1   (area=1: town/district only, for rough locations)
exports.reverse = asyncHandler(async (req, res) => {
  const { lat, lng } = readPoint(req.query, true);
  res.json({ success: true, data: { label: await reverse(lat, lng, { area: req.query.area === '1' }), lat, lng } });
});

// @route   GET /api/geocode/check-pin?address=&city=&state=&lat=&lng=
// Live check for the station form: the pin's place name, where the address points and whether they disagree
exports.checkPin = asyncHandler(async (req, res) => {
  const [address, city, state] = ['address', 'city', 'state'].map((key) => String(req.query[key] || '').trim());
  if (!address && !city) throw new AppError(400, 'An address or city is required');
  res.json({ success: true, data: await checkPin({ address, city, state, coordinates: readPoint(req.query, false) }) });
});
