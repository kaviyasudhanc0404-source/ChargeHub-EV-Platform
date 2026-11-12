// Loads the GeoNames gazetteer (CC BY 4.0, https://www.geonames.org) into the `places` collection:
// every populated place in Tamil Nadu + towns with 1,000+ people elsewhere in India.
// Safe to re-run (upserts by GeoNames id). Usage: npm run import-places
const AdmZip = require('adm-zip');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Place = require('./models/Place.model');
const { normalize } = require('./utils/text');

const DUMP = 'https://download.geonames.org/export/dump';
const TAMIL_NADU = '25';           // GeoNames admin1 code
const MIN_POPULATION_ELSEWHERE = 1000;
const MAX_SPELLINGS = 8;
const BATCH = 2000;
const LATIN = /^[ -~À-ɏḀ-ỿ]+$/;

const download = async (file) => {
  const response = await fetch(`${DUMP}/${file}`, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};

// "IN.25<TAB>Tamil Nadu<TAB>…" → Map { "IN.25" => "Tamil Nadu" }
const codeNames = (buffer) => new Map(buffer.toString('utf8').split('\n')
  .map(line => line.split('\t'))
  .filter(cols => cols[0].startsWith('IN.'))
  .map(cols => [cols[0], cols[2] || cols[1]]));

const toPlace = (c, states, districts) => {
  const [geonameId, name, asciiName, alternates, lat, lng, featureClass, , , , admin1, admin2, , , population] = c;
  if (featureClass !== 'P') return null;
  const inTamilNadu = admin1 === TAMIL_NADU;
  if (!inTamilNadu && Number(population) < MIN_POPULATION_ELSEWHERE) return null;

  const spellings = [...new Set([name, asciiName, ...alternates.split(',')]
    .filter(n => n && LATIN.test(n))
    .map(normalize)
    .filter(n => n.length >= 3))].slice(0, MAX_SPELLINGS);
  if (!spellings.length) return null;

  return {
    geonameId: Number(geonameId),
    name: asciiName || name,
    names: spellings,
    district: districts.get(`IN.${admin1}.${admin2}`),
    state: states.get(`IN.${admin1}`),
    inTamilNadu,
    population: Number(population) || 0,
    lat: Number(lat),
    lng: Number(lng)
  };
};

async function importPlaces() {
  console.log('Downloading GeoNames data…');
  const [zip, admin1, admin2] = await Promise.all([download('IN.zip'), download('admin1CodesASCII.txt'), download('admin2Codes.txt')]);
  const states = codeNames(admin1);
  const districts = codeNames(admin2);
  const rows = new AdmZip(zip).readAsText('IN.txt', 'utf8').split('\n').filter(Boolean).map(line => line.split('\t'));
  const places = rows.map(c => toPlace(c, states, districts)).filter(Boolean);
  console.log(`${places.length} places (${places.filter(p => p.inTamilNadu).length} in Tamil Nadu) from ${rows.length} GeoNames rows`);

  await connectDB();
  for (let i = 0; i < places.length; i += BATCH) {
    await Place.bulkWrite(places.slice(i, i + BATCH).map(place => ({
      replaceOne: { filter: { geonameId: place.geonameId }, replacement: place, upsert: true }
    })), { ordered: false });
    process.stdout.write(`\r  saved ${Math.min(i + BATCH, places.length)}/${places.length}`);
  }
  await Place.syncIndexes();
  console.log('\n✅ Places imported');
}

importPlaces()
  .catch((err) => {
    console.error('❌ Import failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
