// Open Location Code ("plus code") support, per https://github.com/google/open-location-code (Apache-2.0 spec)
const ALPHABET = '23456789CFGHJMPQRVWX';
const PAIR_RESOLUTIONS = [20, 1, 0.05, 0.0025, 0.000125]; // degrees per digit for each lat/lng pair
const CODE = `[${ALPHABET}]`;
// Full codes have 8 digits before "+", short codes 2/4/6 (they need a nearby reference place)
const PLUS_CODE_IN_TEXT = new RegExp(`(?:^|[\\s,])(${CODE}{2,8}\\+${CODE}{0,7})(?=$|[\\s,])`, 'i');

const digitValue = (ch) => ALPHABET.indexOf(ch);

// Centre of the area described by a full code (no padding)
const decode = (code) => {
  const digits = code.replace('+', '').toUpperCase();
  let lat = -90;
  let lng = -180;
  let latStep = 0;
  let lngStep = 0;
  for (let i = 0; i < Math.min(digits.length, 10); i += 2) {
    latStep = lngStep = PAIR_RESOLUTIONS[i / 2];
    lat += digitValue(digits[i]) * latStep;
    lng += digitValue(digits[i + 1]) * lngStep;
  }
  // Grid refinement digits (5 rows × 4 columns each)
  for (const ch of digits.slice(10)) {
    latStep /= 5;
    lngStep /= 4;
    lat += Math.floor(digitValue(ch) / 4) * latStep;
    lng += (digitValue(ch) % 4) * lngStep;
  }
  return { lat: lat + latStep / 2, lng: lng + lngStep / 2 };
};

// First `length` digits of the code for a point
const encodePrefix = (lat, lng, length) => {
  let a = lat + 90;
  let b = lng + 180;
  let out = '';
  for (let i = 0; i < length / 2; i++) {
    const res = PAIR_RESOLUTIONS[i];
    const da = Math.floor(a / res);
    const db = Math.floor(b / res);
    out += ALPHABET[da] + ALPHABET[db];
    a -= da * res;
    b -= db * res;
  }
  return out;
};

// Short code + reference point → nearest matching full location
const recoverNearest = (shortCode, reference) => {
  const padding = 8 - shortCode.indexOf('+');
  const resolution = 20 ** (2 - padding / 2);
  const centre = decode(encodePrefix(reference.lat, reference.lng, padding) + shortCode);
  const fix = (value, ref) => {
    if (ref + resolution / 2 < value) return value - resolution;
    if (ref - resolution / 2 > value) return value + resolution;
    return value;
  };
  return { lat: fix(centre.lat, reference.lat), lng: fix(centre.lng, reference.lng) };
};

/** Finds a plus code in free text. Returns { code, isFull, rest } or null. */
const findPlusCode = (text) => {
  const match = String(text).match(PLUS_CODE_IN_TEXT);
  if (!match) return null;
  const code = match[1].toUpperCase();
  const before = code.indexOf('+');
  if (before % 2 !== 0 || (before < 8 && code.length - before - 1 < 2)) return null;
  const rest = String(text).replace(match[1], ' ').replace(/^[\s,]+|[\s,]+$/g, '').replace(/\s*,\s*,/g, ',');
  return { code, isFull: before === 8, rest };
};

/** The spot a plus code in free text names, as { code, lat, lng } (a short code is resolved near `reference`), or null */
const plusCodePoint = (text, reference) => {
  const plus = findPlusCode(text || '');
  if (!plus || (!plus.isFull && !reference)) return null;
  return { code: plus.code, ...(plus.isFull ? decode(plus.code) : recoverNearest(plus.code, reference)) };
};

module.exports = { decode, recoverNearest, findPlusCode, plusCodePoint };
