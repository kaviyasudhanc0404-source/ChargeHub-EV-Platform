const Place = require('../models/Place.model');
const { remember } = require('../utils/cache');
const { straightLineKm } = require('../utils/geo');
const { normalize, words, escapeRegex } = require('../utils/text');
const { decode, recoverNearest, findPlusCode } = require('../utils/plusCode');
const { AppError } = require('../middleware/error.middleware');

// Place search for India with Tamil Nadu first. Sources:
//  1. `places` gazetteer in MongoDB (GeoNames: all Tamil Nadu villages/towns) — instant, no rate limits
//  2. Photon (OpenStreetMap) — addresses, landmarks, streets
//  3. Nominatim (OpenStreetMap) — fallback when nothing matches well
// Results are merged, ranked here and cached in MongoDB.
const PHOTON_URL = 'https://photon.komoot.io';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const INDIA_BBOX = '68.1,6.5,97.5,35.7'; // minLng, minLat, maxLng, maxLat
const USER_AGENT = 'ChargeHub-EV-App/1.0';
const SEARCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REVERSE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const NOMINATIM_INTERVAL_MS = 1100; // Nominatim usage policy: max 1 request per second
const MAX_RESULTS = 6;
const MAX_LABEL_PARTS = 5;
const SAME_PLACE_KM = 15; // same-named results closer than this are one place (e.g. segments of one road)
// Landmark words that rarely appear in place names ("Gobi bus stand" → match "Gobi")
const GENERIC_WORDS = new Set(['bus', 'stand', 'busstand', 'stop', 'station', 'railway', 'road', 'rd', 'street', 'st', 'near', 'opp',
  'opposite', 'junction', 'main', 'new', 'old', 'market', 'temple', 'school', 'college', 'hospital', 'signal', 'circle', 'ward', 'post']);

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`${new URL(url).host} responded ${response.status}`);
  return response.json();
};

let nextNominatimSlot = 0;
const throttleNominatim = async () => {
  const wait = Math.max(0, nextNominatimSlot - Date.now());
  nextNominatimSlot = Math.max(Date.now(), nextNominatimSlot) + NOMINATIM_INTERVAL_MS;
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
};

// Edit distance capped at `max` (small spelling differences: "palayam" vs "palaiyam")
const withinEdits = (a, b, max) => {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (Math.min(...row) > max) return false;
    prev = row;
  }
  return prev[b.length] <= max;
};

// Short label: drop empty parts and near-duplicates ("Gobichettipalayam" / "Gobichettipalaiyam"), keep at most 5 parts
const compactLabel = (parts) => parts.reduce((kept, part) => {
  const text = part && String(part).trim();
  if (!text || kept.length >= MAX_LABEL_PARTS) return kept;
  const lower = text.toLowerCase();
  const duplicate = kept.some(k => k.toLowerCase() === lower || (lower.length >= 6 && withinEdits(k.toLowerCase(), lower, 2)));
  return duplicate ? kept : [...kept, text];
}, []).join(', ');

// ---------- Sources: each returns [{ label, lat, lng, area, tn, text }] ----------

const gazetteerSearch = async (tokens) => {
  const prefixes = [...new Set(tokens.filter(t => !GENERIC_WORDS.has(t) && t.length >= 3).map(t => t.slice(0, 4)))];
  if (!prefixes.length) return [];
  const places = await Place.find({ names: { $in: prefixes.map(p => new RegExp(`^${escapeRegex(p)}`)) } })
    .sort({ inTamilNadu: -1, population: -1 })
    .limit(200)
    .lean();
  return places.map(p => ({
    label: compactLabel([p.name, p.district, p.state]),
    lat: p.lat,
    lng: p.lng,
    area: true,
    tn: p.inTamilNadu,
    text: [...p.names, p.district, p.state].filter(Boolean).join(' ')
  }));
};

const photonPlace = ({ geometry, properties: p }) => ({
  label: compactLabel([p.name, p.name ? null : p.street, p.locality, p.district, p.city, p.county, [p.state, p.postcode].filter(Boolean).join(' ')]),
  lat: geometry.coordinates[1],
  lng: geometry.coordinates[0],
  area: ['place', 'boundary'].includes(p.osm_key),
  tn: p.state === 'Tamil Nadu',
  text: [p.name, p.street, p.locality, p.district, p.city, p.county, p.state, p.postcode].filter(Boolean).join(' ')
});

const photonSearch = async (query, near) => {
  const params = new URLSearchParams({ q: query, limit: '10', lang: 'en', bbox: INDIA_BBOX });
  if (near) {
    params.set('lat', near.lat);
    params.set('lon', near.lng);
  }
  const data = await fetchJson(`${PHOTON_URL}/api/?${params}`);
  return data.features.filter(f => f.properties.countrycode === 'IN').map(photonPlace);
};

// "Name, Road, Area, City, District, State, 638476, India" → "Name, Road, Area, State 638476"
const nominatimLabel = (displayName) => {
  const parts = displayName.split(', ').filter(part => part !== 'India');
  if (/^\d{6}$/.test(parts[parts.length - 1]) && parts.length > 1) parts.splice(-2, 2, `${parts[parts.length - 2]} ${parts[parts.length - 1]}`);
  return compactLabel([...parts.slice(0, -1).slice(0, MAX_LABEL_PARTS - 1), parts[parts.length - 1]]);
};

const nominatimPlace = (hit) => ({
  label: nominatimLabel(hit.display_name),
  lat: parseFloat(hit.lat),
  lng: parseFloat(hit.lon),
  area: ['place', 'boundary'].includes(hit.category),
  tn: hit.display_name.includes('Tamil Nadu'),
  text: hit.display_name
});

const nominatimSearch = async (query) => {
  await throttleNominatim();
  const params = new URLSearchParams({ q: query, format: 'jsonv2', countrycodes: 'in', limit: '10' });
  return (await fetchJson(`${NOMINATIM_URL}/search?${params}`)).map(nominatimPlace);
};

// The nearest named building or shop only says what a point is next to, not where it is
const nearLabel = (label, name, osmKey) => (name && !['place', 'boundary', 'highway'].includes(osmKey) ? `Near ${label}` : label);

const photonReverse = async (lat, lng) => {
  const data = await fetchJson(`${PHOTON_URL}/reverse?${new URLSearchParams({ lat, lon: lng, lang: 'en', limit: '1' })}`);
  const hit = data.features[0];
  return hit && nearLabel(photonPlace(hit).label, hit.properties.name, hit.properties.osm_key);
};

const nominatimReverse = async (lat, lng) => {
  await throttleNominatim();
  const hit = await fetchJson(`${NOMINATIM_URL}/reverse?${new URLSearchParams({ lat, lon: lng, format: 'jsonv2', zoom: '16' })}`);
  return hit.display_name && nearLabel(nominatimPlace(hit).label, hit.name, hit.category);
};

// Town/district name for a point (for rough device locations, where the nearest landmark would be misleading)
const photonArea = async (lat, lng) => {
  const data = await fetchJson(`${PHOTON_URL}/reverse?${new URLSearchParams({ lat, lon: lng, lang: 'en', limit: '1' })}`);
  const p = data.features[0]?.properties;
  return p && compactLabel([p.city || p.county || p.district, p.state]);
};

const nominatimArea = async (lat, lng) => {
  await throttleNominatim();
  const hit = await fetchJson(`${NOMINATIM_URL}/reverse?${new URLSearchParams({ lat, lon: lng, format: 'jsonv2', zoom: '10' })}`);
  const a = hit.address;
  return a && compactLabel([a.city || a.town || a.county || a.state_district, a.state]);
};

// Run a source; null means it failed (as opposed to an empty answer)
const attempt = async (source) => {
  try {
    return await source();
  } catch (err) {
    console.warn('Geocoding source failed:', err.message);
    return null;
  }
};

// ---------- Ranking ----------

// 1 = exact word (or, for the word being typed, the start of one), 0.9 = small spelling difference, 0 = missing
const tokenMatch = (token, placeWords, isLast) => {
  if (placeWords.includes(token)) return 1;
  if (isLast && token.length >= 3 && placeWords.some(w => w.startsWith(token))) return 1;
  return token.length >= 5 && placeWords.some(w => withinEdits(token, w, token.length >= 9 ? 2 : 1)) ? 0.9 : 0;
};

// Share of the query found in the full address (place names count more than generic landmark words)
const matchScore = (place, tokens) => {
  const placeWords = words(place.text || place.label);
  let total = 0;
  let matched = 0;
  tokens.forEach((token, i) => {
    const weight = GENERIC_WORDS.has(token) ? 0.3 : 1;
    total += weight;
    matched += weight * tokenMatch(token, placeWords, i === tokens.length - 1);
  });
  return total ? matched / total : 0;
};

const leadingName = (label) => normalize(label.split(',')[0]);

// Best match → Tamil Nadu → towns/villages before single buildings → nearest; each place listed once
const rank = (places, tokens, near) => places
  .map((place, order) => ({ ...place, order, score: matchScore(place, tokens), km: near ? straightLineKm(near, place) : 0 }))
  .sort((a, b) => b.score - a.score || Number(b.tn) - Number(a.tn) || Number(b.area) - Number(a.area) || a.km - b.km || a.order - b.order)
  .filter((place, i, all) => all.findIndex(o => {
    const km = straightLineKm(o, place);
    return km < 0.05 || (km < SAME_PLACE_KM && leadingName(o.label) === leadingName(place.label));
  }) === i);

const searchSources = async (text, near) => {
  const tokens = words(text);
  const [gazetteer, photon] = await Promise.all([attempt(() => gazetteerSearch(tokens)), attempt(() => photonSearch(text, near))]);
  let ranked = rank([...(gazetteer || []), ...(photon || [])], tokens, near);

  // No complete Tamil Nadu match: also ask Nominatim
  if (!ranked[0] || ranked[0].score < 1 || !ranked[0].tn) {
    const nominatim = await attempt(() => nominatimSearch(text));
    if (gazetteer === null && photon === null && nominatim === null) {
      throw new AppError(503, 'Location search is temporarily unavailable. Please try again.');
    }
    ranked = rank([...ranked, ...(nominatim || [])], tokens, near);
  }
  return ranked.filter(p => p.score > 0).slice(0, MAX_RESULTS).map(({ label, lat, lng }) => ({ label, lat, lng }));
};

// ---------- Public API ----------

// "C6FH+9XW Ukkaram" → exact point (short codes are resolved near the named place or the user)
const searchPlusCode = async (plus, near) => {
  if (plus.isFull) return [{ label: `Plus code ${plus.code}`, ...decode(plus.code) }];
  const reference = plus.rest ? (await search(plus.rest, near))[0] : near;
  if (!reference) throw new AppError(400, 'Add the town name after a short plus code, e.g. "C6FH+9XW Sathyamangalam"');
  return [{ label: compactLabel([plus.rest, `Plus code ${plus.code}`]), ...recoverNearest(plus.code, reference) }];
};

/**
 * Place suggestions anywhere in India (Tamil Nadu first), ranked by match quality and closeness to `near`.
 * Returns up to 6 × { label, lat, lng }.
 */
async function search(query, near) {
  const text = String(query || '').trim().replace(/\s+/g, ' ');
  if (text.length < 2) throw new AppError(400, 'Type at least 2 characters');

  const plus = findPlusCode(text);
  if (plus) return searchPlusCode(plus, near);

  // ~10 km bias cell keeps the cache effective while preserving local ranking
  const bias = near ? `|${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : '';
  return remember(`geo:search:${text.toLowerCase()}${bias}`, SEARCH_TTL_MS, () => searchSources(text, near));
}

// Best single match (used when a station is saved without a map pin)
async function geocode(query, near) {
  const [best] = await search(query, near);
  if (!best) throw new AppError(404, `Location "${query}" not found. Try a nearby town or landmark.`);
  return best;
}

// Human-readable name for a point (cache v2: landmark names start with "Near"). With `area`, only the town/district
// ("Around Coimbatore, Tamil Nadu"), cached per ~1 km: for a device location that is only known roughly.
async function reverse(lat, lng, { area = false } = {}) {
  if (area) {
    const name = await remember(`geo:area:${lat.toFixed(2)},${lng.toFixed(2)}`, REVERSE_TTL_MS, async () =>
      (await attempt(() => photonArea(lat, lng))) || (await attempt(() => nominatimArea(lat, lng))));
    return name ? `Around ${name}` : `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  }
  const label = await remember(`geo:reverse2:${lat.toFixed(4)},${lng.toFixed(4)}`, REVERSE_TTL_MS, async () =>
    (await attempt(() => photonReverse(lat, lng))) || (await attempt(() => nominatimReverse(lat, lng))));
  return label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

module.exports = { search, geocode, reverse };
