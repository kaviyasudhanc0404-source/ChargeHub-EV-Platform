const { getMany, setMany } = require('../utils/cache');
const { straightLineKm } = require('../utils/geo');

// Road distance + drive time from one origin to many destinations.
// OpenRouteService (free key) → OSRM public server → estimate from straight-line distance.
const ORS_MATRIX_URL = 'https://api.openrouteservice.org/v2/matrix/driving-car';
const OSRM_URL = process.env.OSRM_URL || 'https://router.project-osrm.org';
const ROUTE_TTL_MS = 24 * 60 * 60 * 1000;
const ROAD_FACTOR = 1.3; // typical road vs straight-line ratio, used only for estimates
const TIMEOUT_MS = 8000;
// Routing engines assume empty roads at the speed limit (65–85 km/h even in town), so their times are 2–4× too short
// for Indian traffic. Drive time is never shown below town speed for the first TOWN_KM and highway speed after that,
// which matches Google Maps' usual times (3.4 km across Coimbatore ≈ 9 min, 80 km to Gobi ≈ 1 h 50 min).
const TOWN_KM = 10;
const TOWN_SPEED_KMH = 24;
const HIGHWAY_SPEED_KMH = 50;

const round1 = (n) => Math.round(n * 10) / 10;

const typicalMinutes = (km) => (Math.min(km, TOWN_KM) / TOWN_SPEED_KMH + Math.max(km - TOWN_KM, 0) / HIGHWAY_SPEED_KMH) * 60;

const withTypicalTime = ({ km, minutes, method }) => ({ km, minutes: Math.round(Math.max(minutes, typicalMinutes(km))), method });

const toResult = (km, seconds, method) => (km == null ? null : { km: round1(km), minutes: Math.round(seconds / 60), method });

const viaOpenRouteService = async (origin, dests) => {
  if (!process.env.ORS_API_KEY) throw new Error('ORS_API_KEY not set');
  const response = await fetch(ORS_MATRIX_URL, {
    method: 'POST',
    headers: { Authorization: process.env.ORS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locations: [origin, ...dests].map(p => [p.lng, p.lat]),
      sources: [0],
      destinations: dests.map((_, i) => i + 1),
      metrics: ['distance', 'duration'],
      units: 'km'
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`OpenRouteService responded ${response.status}`);
  const data = await response.json();
  return dests.map((_, i) => toResult(data.distances[0][i], data.durations[0][i], 'road'));
};

const viaOsrm = async (origin, dests) => {
  const coords = [origin, ...dests].map(p => `${p.lng},${p.lat}`).join(';');
  const response = await fetch(`${OSRM_URL}/table/v1/driving/${coords}?sources=0&annotations=distance,duration`, {
    headers: { 'User-Agent': 'ChargeHub-EV-App/1.0' },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const data = await response.json();
  if (!response.ok || data.code !== 'Ok') throw new Error(`OSRM responded ${data.code || response.status}`);
  return dests.map((_, i) => toResult(data.distances[0][i + 1] == null ? null : data.distances[0][i + 1] / 1000, data.durations[0][i + 1], 'road'));
};

const estimate = (origin, dest) => {
  const km = straightLineKm(origin, dest) * ROAD_FACTOR;
  return { km: round1(km), minutes: 0, method: 'estimate' }; // no engine time: the typical time is used
};

const fromProviders = async (origin, dests) => {
  for (const provider of [viaOpenRouteService, viaOsrm]) {
    try {
      return await provider(origin, dests);
    } catch (err) {
      console.warn('Routing provider failed:', err.message);
    }
  }
  return dests.map(() => null);
};

/**
 * [{ km, minutes, method: 'road' | 'estimate' }] for each destination, in order.
 * Results are cached per ~100 m origin cell so nearby users reuse them.
 */
async function roadDistances(origin, dests) {
  if (!dests.length) return [];
  const cell = `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}`;
  const keys = dests.map(d => `route:${cell}>${d.lat.toFixed(5)},${d.lng.toFixed(5)}`);
  const cached = await getMany(keys);

  const missing = dests.map((_, i) => i).filter(i => !cached.has(keys[i]));
  const fresh = missing.length ? await fromProviders(origin, missing.map(i => dests[i])) : [];
  const toStore = [];
  missing.forEach((destIndex, j) => {
    if (fresh[j]) {
      cached.set(keys[destIndex], fresh[j]);
      toStore.push([keys[destIndex], fresh[j]]);
    }
  });
  await setMany(toStore, ROUTE_TTL_MS);

  // Applied on read, so results cached before the traffic correction are corrected too
  return dests.map((d, i) => withTypicalTime(cached.get(keys[i]) || estimate(origin, d)));
}

module.exports = { roadDistances };
