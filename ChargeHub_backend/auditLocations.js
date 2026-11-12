// Checks every active station's map pin against its address, with the same rules used when a station is saved.
// Usage: npm run audit:locations          → report only
//        npm run audit:locations:fix      → back up all stations to backups/, then move each pin that disagrees
//                                           with a plus code in its address onto that plus code
// Pins that only disagree with the area named in the address are listed for their provider to correct.
// Exits with code 1 while any mismatch remains, so it can gate a deploy.
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Station = require('./models/Station.model');
const { checkPin } = require('./services/stationPin.service');

const fix = process.argv.includes('--fix');

// Restore with: mongoimport --uri "$MONGODB_URI" --collection stations --mode upsert --jsonArray --file <backup>
const backup = async () => {
  const dir = path.join(__dirname, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `stations-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const docs = await Station.collection.find().toArray();
  fs.writeFileSync(file, mongoose.mongo.BSON.EJSON.stringify(docs, null, 2));
  console.log(`💾 Backed up ${docs.length} stations to ${file}`);
};

async function audit() {
  await connectDB();
  if (fix) await backup();

  const stations = await Station.find({ isActive: true });
  let fixed = 0;
  let remaining = 0;
  for (const station of stations) {
    const { target, mismatch } = await checkPin(station.location.toObject());
    if (!mismatch) continue;
    const line = `${station.name} (${station._id}): ${mismatch.message}`;
    if (fix && mismatch.kind === 'plusCode') {
      station.location.coordinates = { lat: target.lat, lng: target.lng };
      await station.save();
      fixed++;
      console.log(`✅ Moved to ${target.code} — ${line}`);
    } else {
      remaining++;
      console.log(`⚠️  ${line}`);
    }
  }
  console.log(`\nChecked ${stations.length} stations: ${fixed} fixed, ${remaining} need attention.${remaining && !fix ? ' Run npm run audit:locations:fix to move pins to plus codes.' : ''}`);
  return remaining;
}

audit()
  .then((remaining) => { process.exitCode = remaining ? 1 : 0; })
  .catch((err) => {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
