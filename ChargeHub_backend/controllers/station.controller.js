const Station = require('../models/Station.model');
const User = require('../models/User.model');
const Booking = require('../models/Booking.model');
const { geocode } = require('../services/geocoding.service');
const { PUBLIC_FILTER, nearbyStations } = require('../services/stationSearch.service');
const { hasValidCoords, checkPin } = require('../services/stationPin.service');
const { escapeRegex } = require('../utils/text');
const { readPoint } = require('../utils/geo');
const { AppError, asyncHandler } = require('../middleware/error.middleware');

const PUBLIC_FIELDS = '-totalRevenue -__v';
const FEATURED_STATIONS = 6; // shown in turn on the home page

// Fields a provider may set on a station (everything else is server-controlled)
const pickStationFields = (body = {}) => {
  const fields = {};
  ['name', 'chargerType', 'power', 'vehicleType', 'connectorTypes', 'amenities', 'operatingHours'].forEach((key) => {
    if (body[key] !== undefined) fields[key] = body[key];
  });
  if (body.pricing?.ratePerHour !== undefined) fields.pricing = { ratePerHour: body.pricing.ratePerHour, currency: 'INR' };
  if (body.location) {
    fields.location = {};
    ['address', 'city', 'state', 'pincode', 'coordinates'].forEach((key) => {
      if (body.location[key] !== undefined) fields.location[key] = body.location[key];
    });
  }
  return fields;
};

// Fill in coordinates from the address when the provider did not drop a map pin; otherwise check the pin against the
// address. A pin away from a plus code is refused; a pin away from the named area is saved only once the provider
// confirms it (409 with reason PIN_CONFIRM → the app asks, then resends with location.pinConfirmed).
const ensureCoordinates = async (location, pinConfirmed) => {
  if (!hasValidCoords(location.coordinates)) {
    const { lat, lng } = await geocode([location.address, location.city, location.state, 'India'].filter(Boolean).join(', '));
    return { ...location, coordinates: { lat, lng } };
  }
  const { mismatch } = await checkPin(location);
  if (mismatch?.kind === 'plusCode') throw new AppError(400, mismatch.message);
  if (mismatch && !pinConfirmed) throw new AppError(409, mismatch.message, 'PIN_CONFIRM');
  return location;
};

const pinConfirmed = (req) => req.body.location?.pinConfirmed === true;

const findOwnedStation = async (req) => {
  const station = await Station.findById(req.params.id);
  if (!station || !station.isActive) throw new AppError(404, 'Station not found');
  if (req.user.role !== 'admin' && !station.providerId.equals(req.user._id)) {
    throw new AppError(403, 'Not authorized to modify this station');
  }
  return station;
};

// @route   GET /api/stations   (public, approved stations)
exports.getAllStations = asyncHandler(async (req, res) => {
  const { city, state, vehicleType, chargerType } = req.query;
  const filter = { ...PUBLIC_FILTER };
  if (city) filter['location.city'] = new RegExp(`^${escapeRegex(city)}$`, 'i');
  if (state) filter['location.state'] = new RegExp(`^${escapeRegex(state)}$`, 'i');
  if (vehicleType) filter.vehicleType = { $in: [vehicleType, 'both'] };
  if (chargerType) filter.chargerType = chargerType;

  const stations = await Station.find(filter)
    .select(PUBLIC_FIELDS)
    .populate('providerId', 'name phone')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, count: stations.length, data: stations });
});

// @route   GET /api/stations/stats   (public platform figures for the landing page)
// Also returns a few random online stations for the home page showcase (one request for the whole hero)
exports.getPublicStats = asyncHandler(async (req, res) => {
  const [stations, providers, users, sessions, featured] = await Promise.all([
    Station.countDocuments(PUBLIC_FILTER),
    User.countDocuments({ role: 'provider', isActive: true }),
    User.countDocuments({ role: 'user', isActive: true }),
    Booking.countDocuments({ status: 'completed' }),
    Station.aggregate([
      { $match: { ...PUBLIC_FILTER, 'availability.isAvailable': true } },
      { $sample: { size: FEATURED_STATIONS } },
      { $project: { name: 1, 'location.city': 1, chargerType: 1, power: 1, connectorTypes: 1, vehicleType: 1, 'pricing.ratePerHour': 1 } }
    ])
  ]);
  res.set('Cache-Control', 'public, max-age=300').json({ success: true, data: { stations, providers, users, sessions, featured } });
});

// @route   GET /api/stations/nearby?lat=&lng=&limit=
exports.getNearbyStations = asyncHandler(async (req, res) => {
  const origin = readPoint(req.query, true);
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const data = await nearbyStations(origin, { limit });
  res.json({ success: true, count: data.length, data });
});

// @route   GET /api/stations/mine   (provider's own stations, including ones awaiting approval)
exports.getMyStations = asyncHandler(async (req, res) => {
  const stations = await Station.find({ providerId: req.user._id, isActive: true }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, count: stations.length, data: stations });
});

// @route   POST /api/stations
exports.createStation = asyncHandler(async (req, res) => {
  const fields = pickStationFields(req.body);
  if (!fields.location?.address || !fields.location?.city || !fields.location?.state) {
    throw new AppError(400, 'Station address, city and state are required');
  }
  fields.location = await ensureCoordinates(fields.location, pinConfirmed(req));

  const station = await Station.create({ ...fields, providerId: req.user._id, providerName: req.user.name });
  res.status(201).json({ success: true, message: 'Station submitted for admin approval', data: station });
});

// @route   PUT /api/stations/:id
exports.updateStation = asyncHandler(async (req, res) => {
  const station = await findOwnedStation(req);
  const fields = pickStationFields(req.body);
  if (fields.location) {
    fields.location = await ensureCoordinates({ ...station.location.toObject(), ...fields.location }, pinConfirmed(req));
  }
  station.set(fields);
  await station.save();
  res.json({ success: true, message: 'Station updated successfully', data: station });
});

// @route   PATCH /api/stations/:id/availability
exports.updateAvailability = asyncHandler(async (req, res) => {
  const station = await findOwnedStation(req);
  station.availability.isAvailable = Boolean(req.body.isAvailable);
  await station.save();
  res.json({ success: true, message: `Station is now ${station.availability.isAvailable ? 'online' : 'offline'}`, data: station });
});

// @route   DELETE /api/stations/:id   (soft delete)
exports.deleteStation = asyncHandler(async (req, res) => {
  const station = await findOwnedStation(req);
  station.isActive = false;
  await station.save();
  res.json({ success: true, message: 'Station deleted successfully' });
});
