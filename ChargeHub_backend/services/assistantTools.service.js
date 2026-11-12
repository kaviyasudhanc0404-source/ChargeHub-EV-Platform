const mongoose = require('mongoose');
const Station = require('../models/Station.model');
const Booking = require('../models/Booking.model');
const { geocode } = require('./geocoding.service');
const { PUBLIC_FILTER, isOpenNow, nearbyStations } = require('./stationSearch.service');
const { to12h } = require('../utils/time');

// Live-data tools the "Ask Me" assistant may call. Each handler gets the model's arguments and { user, origin } and
// returns { result } (sent back to the model) plus optional `extras` for the app (station cards, location request).
// The model only reads data; bookings are made by the driver in the app.

const SEARCH_POOL = 20; // nearest stations considered before filtering by opening hours
const MAX_SHOWN = 5;
const DC_KW = 50; // DC fast chargers slow down above TAPER_FROM %
const TAPER_FROM = 80;
const CHARGE_EFFICIENCY = 0.9; // share of charger power that reaches the battery

const CONNECTORS = Station.schema.path('connectorTypes').caster.enumValues;
const clamp = (n, min, max) => Math.min(Math.max(Number(n) || 0, min), max);
const istDateTime = (date) => new Date(date).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
});

const declarations = [
  {
    name: 'find_stations',
    description: 'Find approved ChargeHub charging stations nearest the user (or near a named place), with road distance, drive time, power, connectors, price and whether they are online and open now.',
    parameters: {
      type: 'object',
      properties: {
        place: { type: 'string', description: 'A town, area or landmark the user named, e.g. "Gandhipuram, Coimbatore". Leave empty for "near me".' },
        vehicleType: { type: 'string', enum: ['car', 'bike'] },
        connector: { type: 'string', enum: CONNECTORS },
        minPowerKw: { type: 'number', description: 'e.g. 50 for "DC fast"' },
        maxPricePerHour: { type: 'number', description: 'Maximum price in INR per hour' },
        onlineOnly: { type: 'boolean', description: 'Only stations the provider has switched online' },
        openNow: { type: 'boolean', description: 'Only stations open at this moment' },
        limit: { type: 'integer', description: `How many to show, 1–${MAX_SHOWN} (default 3)` }
      }
    }
  },
  {
    name: 'get_my_bookings',
    description: "The signed-in driver's most recent charging bookings (upcoming first) with station, time, status and cost.",
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'estimate_charge',
    description: 'Estimate charging time and cost at one station from fromPercent to toPercent battery.',
    parameters: {
      type: 'object',
      properties: {
        stationId: { type: 'string', description: 'The id of a station returned by find_stations' },
        fromPercent: { type: 'number' },
        toPercent: { type: 'number' },
        batteryKwh: { type: 'number', description: "Usable battery size; omit to use the driver's saved vehicle" },
        vehicleMaxKw: { type: 'number', description: 'Maximum charging power the vehicle accepts on this charger type, if known' }
      },
      required: ['stationId', 'fromPercent', 'toPercent']
    }
  }
];

// What the model sees for each station (the app shows the full card)
const stationSummary = (s) => ({
  id: String(s._id),
  name: s.name,
  area: s.location.city,
  roadKm: s.distance.km,
  driveMinutes: s.distance.minutes,
  powerKw: s.power,
  connectors: s.connectorTypes,
  vehicles: s.vehicleType,
  pricePerHourInr: s.pricing.ratePerHour,
  online: s.availability.isAvailable,
  openNow: isOpenNow(s.operatingHours),
  hours: s.operatingHours?.is24x7 === false ? `${to12h(s.operatingHours.open)} – ${to12h(s.operatingHours.close)}` : '24x7',
  rating: s.rating?.count ? `${s.rating.average.toFixed(1)} (${s.rating.count})` : 'not rated yet',
  amenities: s.amenities
});

const handlers = {
  async find_stations(args, { origin }) {
    const from = args.place ? await geocode(args.place, origin) : origin;
    if (!from) return { result: { error: 'Location unknown. Ask the user to share their location or name a place.' }, extras: { needsLocation: true } };

    const match = {};
    if (args.vehicleType) match.vehicleType = { $in: [args.vehicleType, 'both'] };
    if (CONNECTORS.includes(args.connector)) match.connectorTypes = args.connector;
    if (args.minPowerKw > 0) match.power = { $gte: Number(args.minPowerKw) };
    if (args.maxPricePerHour > 0) match['pricing.ratePerHour'] = { $lte: Number(args.maxPricePerHour) };
    if (args.onlineOnly) match['availability.isAvailable'] = true;

    const found = (await nearbyStations(from, { match, limit: SEARCH_POOL })).filter(s => !args.openNow || isOpenNow(s.operatingHours));
    const shown = found.slice(0, clamp(args.limit || 3, 1, MAX_SHOWN));
    return {
      result: { distancesFrom: from.label || 'the user', matching: found.length, stations: shown.map(stationSummary) },
      extras: { stations: shown, fromLabel: from.label, context: `Stations shown: ${shown.map(s => `${s.name} [id ${s._id}]`).join('; ')}` }
    };
  },

  async get_my_bookings(args, { user }) {
    if (user.role !== 'user') return { result: { error: 'Only driver accounts have charging bookings.' } };
    const bookings = await Booking.find({ userId: user._id }).sort({ slotStart: -1 }).limit(6).lean();
    const now = new Date();
    const upcoming = bookings.filter(b => b.slotStart > now).reverse(); // soonest first
    return {
      result: {
        bookings: [...upcoming, ...bookings.filter(b => b.slotStart <= now)]
          .map(b => ({
            bookingId: b.bookingId,
            station: b.stationName,
            start: istDateTime(b.slotStart),
            hours: b.duration,
            vehicle: b.vehicleInfo?.vehicleName,
            status: b.status,
            payment: b.paymentStatus,
            costInr: b.pricing?.totalCost
          }))
      }
    };
  },

  async estimate_charge(args, { user }) {
    const station = mongoose.isValidObjectId(args.stationId) && await Station.findOne({ _id: args.stationId, ...PUBLIC_FILTER }).lean();
    if (!station) return { result: { error: 'Station not found. Use an id from find_stations.' } };
    const batteryKwh = Number(args.batteryKwh) || parseFloat(user.vehicleInfo?.batteryCapacity);
    if (!(batteryKwh > 0)) return { result: { error: "Battery size unknown. Ask for the vehicle model or its battery size in kWh." } };

    const [from, to] = [clamp(args.fromPercent, 0, 100), clamp(args.toPercent, 0, 100)];
    const powerKw = Math.min(station.power, Number(args.vehicleMaxKw) || station.power);
    const kwh = (a, b) => (batteryKwh * Math.max(b - a, 0)) / 100;
    const tapers = station.power >= DC_KW;
    const fullSpeedKwh = kwh(from, tapers ? Math.min(to, TAPER_FROM) : to);
    const taperedKwh = tapers ? kwh(Math.max(from, TAPER_FROM), to) : 0;
    const hours = (fullSpeedKwh + taperedKwh * 2) / (powerKw * CHARGE_EFFICIENCY);
    const bookHours = Math.max(1, Math.ceil(hours));
    return {
      result: {
        station: station.name,
        batteryKwh,
        energyAddedKwh: Math.round((fullSpeedKwh + taperedKwh) * 10) / 10,
        chargingPowerKw: powerKw,
        minutes: Math.round(hours * 60),
        costForChargingTimeInr: Math.round(hours * station.pricing.ratePerHour),
        slotToBookHours: bookHours,
        slotCostInr: bookHours * station.pricing.ratePerHour,
        note: tapers && to > TAPER_FROM ? `DC charging slows down above ${TAPER_FROM}%` : undefined
      }
    };
  }
};

// Runs one function call from the model; a failing tool is reported to the model instead of failing the chat
async function runTool({ name, args = {} }, context) {
  const handler = handlers[name];
  if (!handler) return { result: { error: `Unknown tool ${name}` } };
  try {
    return await handler(args, context);
  } catch (err) {
    return { result: { error: err.message } };
  }
}

module.exports = { declarations, runTool };
