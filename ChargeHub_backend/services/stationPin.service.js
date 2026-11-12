const { straightLineKm } = require('../utils/geo');
const { findPlusCode, plusCodePoint } = require('../utils/plusCode');
const { search, reverse } = require('./geocoding.service');

// A station's map pin must agree with its address, or every distance, map marker and Directions link to it is wrong.
//  - A plus code in the address names the exact spot: the pin must be within PIN_TOLERANCE_KM of it.
//  - Otherwise the address only names an area: a pin farther than AREA_TOLERANCE_KM needs the provider's confirmation.
const PIN_TOLERANCE_KM = 0.3; // a 10-character plus code is ~14 m; this allows for placing the pin by hand
const AREA_TOLERANCE_KM = 5;

const hasValidCoords = (c) => !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng);

const shortName = (label) => label.split(',')[0];

// Pin vs. where the address points → { kind, km, message } when they disagree, else null
const compare = (pin, target, place) => {
  const kind = target.code ? 'plusCode' : 'area';
  const km = straightLineKm(target, pin);
  if (km <= (kind === 'plusCode' ? PIN_TOLERANCE_KM : AREA_TOLERANCE_KM)) return null;
  const distance = `${km.toFixed(1)} km`;
  const message = kind === 'plusCode'
    ? `The map pin is ${distance} from plus code ${target.code} in the address. Move the pin to the plus code or drag it to the charger, then save again.`
    : `The map pin${place ? ` (${shortName(place)})` : ''} is ${distance} from ${shortName(target.label)}, named in the address. Make sure the pin is at the charger.`;
  return { kind, km: Math.round(km * 10) / 10, message };
};

/** Plus-code rule only (no network, so the Station model enforces it on every save) */
const plusCodeMismatch = ({ address, coordinates }) => {
  const target = hasValidCoords(coordinates) && plusCodePoint(address, coordinates);
  return target ? compare(coordinates, target) : null;
};

const exactSpot = (point) => point && { ...point, label: `plus code ${point.code}` };

// Best place match for the first query that finds one (most specific first), biased near `near`
const firstMatch = async (queries, near) => {
  for (const parts of queries) {
    const text = parts.filter(Boolean).join(', ');
    if (!text) continue;
    const [best] = await search(text, near).catch(() => []);
    if (best) return best;
  }
  return null;
};

// Where the address points: { lat, lng, label, code? } (`code` when a plus code names the exact spot), or null
const addressPoint = async ({ address, city, state }, near) => {
  const exact = exactSpot(plusCodePoint(address, near));
  if (exact) return exact;
  const plain = findPlusCode(address || '')?.rest ?? address; // the address without its plus code
  const area = await firstMatch([[plain, city, state], [city, state]], near);
  if (!area) return null; // nothing matched: the address cannot be checked
  // A short plus code with no pin yet is resolved near the area named with it
  return exactSpot(plusCodePoint(address, area)) || area;
};

/**
 * Full check of a station location ({ address, city, state, coordinates? }) for the station form, saving and the audit.
 * Returns { place, target, mismatch }: the name of the pin's spot, where the address points, and how they disagree.
 */
async function checkPin(location) {
  const pin = hasValidCoords(location.coordinates) ? location.coordinates : null;
  const [target, place] = await Promise.all([addressPoint(location, pin), pin ? reverse(pin.lat, pin.lng) : null]);
  return { place, target, mismatch: pin && target ? compare(pin, target, place) : null };
}

module.exports = { hasValidCoords, plusCodeMismatch, checkPin };
