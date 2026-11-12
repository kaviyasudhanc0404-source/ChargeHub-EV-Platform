const CacheEntry = require('../models/CacheEntry.model');

const live = () => ({ expiresAt: { $gt: new Date() } });

// Map of key → cached value for the keys that are present and not expired
const getMany = async (keys) => {
  const entries = await CacheEntry.find({ key: { $in: keys }, ...live() }).lean();
  return new Map(entries.map(e => [e.key, e.value]));
};

const setMany = (entries, ttlMs) => {
  if (!entries.length) return Promise.resolve();
  const expiresAt = new Date(Date.now() + ttlMs);
  return CacheEntry.bulkWrite(entries.map(([key, value]) => ({
    updateOne: { filter: { key }, update: { $set: { value, expiresAt } }, upsert: true }
  })), { ordered: false });
};

// Return the cached value for `key`, or compute, store (unless empty) and return it
const remember = async (key, ttlMs, compute) => {
  const hit = (await getMany([key])).get(key);
  if (hit !== undefined) return hit;
  const value = await compute();
  const empty = value === undefined || value === null || (Array.isArray(value) && !value.length);
  if (!empty) await setMany([[key, value]], ttlMs);
  return value;
};

module.exports = { getMany, setMany, remember };
