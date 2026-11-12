// Text helpers shared by search, ranking and the place import

// "Kūgalūr, Tamil Nadu!" → "kugalur tamil nadu" (accents removed, lowercase, letters/digits only)
const normalize = (text) => String(text || '')
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Searchable words (2+ characters)
const words = (text) => normalize(text).split(' ').filter(w => w.length > 1);

// Escape user input before using it inside a RegExp
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { normalize, words, escapeRegex };
