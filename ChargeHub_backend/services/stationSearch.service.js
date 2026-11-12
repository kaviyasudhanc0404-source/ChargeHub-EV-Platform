const Station = require('../models/Station.model');
const { roadDistances } = require('./routing.service');
const { toMinutes } = require('../utils/time');

// Shared by the station finder and the assistant, so both always list the same stations in the same order
const PUBLIC_FILTER = { isActive: true, isVerified: true };
const ROUTED_STATIONS = 25; // road distances are fetched for this many nearest stations
const IST_OFFSET_MIN = 330; // opening hours are in Indian Standard Time

// Whether a station's opening hours include `now` (hours past midnight, e.g. 18:00–02:00, are supported)
const isOpenNow = ({ is24x7 = true, open = '00:00', close = '23:59' } = {}, now = new Date()) => {
  if (is24x7) return true;
  const time = (now.getUTCHours() * 60 + now.getUTCMinutes() + IST_OFFSET_MIN) % 1440;
  const [from, to] = [toMinutes(open), toMinutes(close)];
  return from <= to ? time >= from && time < to : time >= from || time < to;
};

/**
 * Approved stations nearest to `origin` (narrowed by the Mongo `match`), nearest by road first.
 * Each has `distance: { km, minutes, method }`; stations past the routed ones get a straight-line distance.
 */
async function nearbyStations(origin, { match = {}, limit = 50 } = {}) {
  const stations = await Station.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [origin.lng, origin.lat] },
        key: 'location.point',
        distanceField: 'straightLineMeters',
        query: { ...match, ...PUBLIC_FILTER },
        spherical: true
      }
    },
    { $limit: limit },
    { $project: { totalRevenue: 0, __v: 0 } }
  ]);
  await Station.populate(stations, { path: 'providerId', select: 'name phone' });

  const routed = await roadDistances(origin, stations.slice(0, ROUTED_STATIONS).map(s => s.location.coordinates));
  return stations
    .map(({ straightLineMeters, ...station }, i) => ({
      ...station,
      distance: routed[i] || { km: Math.round(straightLineMeters / 100) / 10, minutes: null, method: 'straight' }
    }))
    .sort((a, b) => a.distance.km - b.distance.km);
}

module.exports = { PUBLIC_FILTER, isOpenNow, nearbyStations };
