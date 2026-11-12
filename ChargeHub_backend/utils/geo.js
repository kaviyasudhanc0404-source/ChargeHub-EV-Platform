const { AppError } = require('../middleware/error.middleware');

// Great-circle (straight-line) distance in km between two { lat, lng } points
const straightLineKm = (a, b) => {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// "lat"/"lng" fields of a query or body → { lat, lng } (validated); undefined when absent unless `required`
const readPoint = (source = {}, required) => {
  const lat = parseFloat(source.lat);
  const lng = parseFloat(source.lng);
  const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  if (required && !valid) throw new AppError(400, 'Valid lat and lng are required');
  return valid ? { lat, lng } : undefined;
};

module.exports = { straightLineKm, readPoint };
