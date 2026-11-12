const connectDB = require('./config/db');
const User = require('./models/User.model');
const Station = require('./models/Station.model');

// Tamil Nadu major cities coordinates
const tamilNaduStations = [
  // Chennai
  {
    name: "Anna Nagar Charging Hub",
    location: {
      address: "2nd Avenue, Anna Nagar",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600040",
      coordinates: { lat: 13.0850, lng: 80.2101 }
    },
    chargerType: "DC Fast Charger (150kW)",
    power: 150,
    vehicleType: "both",
    connectorTypes: ["CCS", "CHAdeMO"],
    pricing: { ratePerHour: 1245, currency: "INR" },
    amenities: ["WiFi", "Restroom", "Cafe", "Parking"],
    is24x7: true
  },
  {
    name: "T Nagar Express Charge",
    location: {
      address: "Pondy Bazaar, T Nagar",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600017",
      coordinates: { lat: 13.0418, lng: 80.2341 }
    },
    chargerType: "DC Fast Charger (100kW)",
    power: 100,
    vehicleType: "car",
    connectorTypes: ["Type 2", "CCS"],
    pricing: { ratePerHour: 996, currency: "INR" },
    amenities: ["WiFi", "Shopping", "Parking"],
    is24x7: false
  },
  {
    name: "OMR Tech Park Station",
    location: {
      address: "Old Mahabalipuram Road, Thoraipakkam",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600097",
      coordinates: { lat: 12.9342, lng: 80.2275 }
    },
    chargerType: "Level 2 (22kW)",
    power: 22,
    vehicleType: "both",
    connectorTypes: ["Type 2"],
    pricing: { ratePerHour: 664, currency: "INR" },
    amenities: ["WiFi", "Restroom", "Cafe"],
    is24x7: true
  },
  // Coimbatore
  {
    name: "Coimbatore RS Puram Station",
    location: {
      address: "RS Puram Main Road",
      city: "Coimbatore",
      state: "Tamil Nadu",
      pincode: "641002",
      coordinates: { lat: 11.0019, lng: 76.9573 }
    },
    chargerType: "DC Fast Charger (150kW)",
    power: 150,
    vehicleType: "both",
    connectorTypes: ["CCS", "CHAdeMO", "Type 2"],
    pricing: { ratePerHour: 1245, currency: "INR" },
    amenities: ["WiFi", "Restroom", "Parking", "Restaurant"],
    is24x7: true
  },
  {
    name: "Gandhipuram Fast Charge",
    location: {
      address: "Gandhipuram Bus Stand",
      city: "Coimbatore",
      state: "Tamil Nadu",
      pincode: "641012",
      coordinates: { lat: 11.0183, lng: 76.9674 }
    },
    chargerType: "DC Fast Charger (100kW)",
    power: 100,
    vehicleType: "both",
    connectorTypes: ["CCS", "Type 2"],
    pricing: { ratePerHour: 996, currency: "INR" },
    amenities: ["WiFi", "Restroom", "Shopping"],
    is24x7: true
  },
  // Madurai
  {
    name: "Madurai Junction Charging",
    location: {
      address: "Near Periyar Bus Stand",
      city: "Madurai",
      state: "Tamil Nadu",
      pincode: "625001",
      coordinates: { lat: 9.9252, lng: 78.1198 }
    },
    chargerType: "DC Fast Charger (100kW)",
    power: 100,
    vehicleType: "both",
    connectorTypes: ["CCS", "Type 2"],
    pricing: { ratePerHour: 996, currency: "INR" },
    amenities: ["WiFi", "Restroom", "Parking"],
    is24x7: true
  },
  {
    name: "Anna Nagar Madurai Station",
    location: {
      address: "Anna Nagar Main Road",
      city: "Madurai",
      state: "Tamil Nadu",
      pincode: "625020",
      coordinates: { lat: 9.9368, lng: 78.1314 }
    },
    chargerType: "Level 2 (22kW)",
    power: 22,
    vehicleType: "both",
    connectorTypes: ["Type 2"],
    pricing: { ratePerHour: 664, currency: "INR" },
    amenities: ["WiFi", "Parking", "Cafe"],
    is24x7: false
  },
  // Trichy
  {
    name: "Trichy Central Charging Hub",
    location: {
      address: "Junction Road, Near Railway Station",
      city: "Tiruchirappalli",
      state: "Tamil Nadu",
      pincode: "620001",
      coordinates: { lat: 10.8155, lng: 78.7047 }
    },
    chargerType: "DC Fast Charger (150kW)",
    power: 150,
    vehicleType: "both",
    connectorTypes: ["CCS", "CHAdeMO"],
    pricing: { ratePerHour: 1245, currency: "INR" },
    amenities: ["WiFi", "Restroom", "Cafe", "Parking"],
    is24x7: true
  },
  // Salem
  {
    name: "Salem Bus Stand Charging",
    location: {
      address: "Town Bus Stand, Salem",
      city: "Salem",
      state: "Tamil Nadu",
      pincode: "636001",
      coordinates: { lat: 11.6643, lng: 78.1460 }
    },
    chargerType: "DC Fast Charger (100kW)",
    power: 100,
    vehicleType: "both",
    connectorTypes: ["CCS", "Type 2"],
    pricing: { ratePerHour: 996, currency: "INR" },
    amenities: ["WiFi", "Restroom", "Parking"],
    is24x7: true
  },
  {
    name: "Salem Steel Plant Station",
    location: {
      address: "Near Steel Plant, Salem",
      city: "Salem",
      state: "Tamil Nadu",
      pincode: "636302",
      coordinates: { lat: 11.6643, lng: 78.1561 }
    },
    chargerType: "Level 2 (22kW)",
    power: 22,
    vehicleType: "car",
    connectorTypes: ["Type 2"],
    pricing: { ratePerHour: 664, currency: "INR" },
    amenities: ["Parking", "Restroom"],
    is24x7: false
  },
  // Tirunelveli
  {
    name: "Tirunelveli Junction Charge",
    location: {
      address: "Near Tirunelveli Junction",
      city: "Tirunelveli",
      state: "Tamil Nadu",
      pincode: "627001",
      coordinates: { lat: 8.7139, lng: 77.7567 }
    },
    chargerType: "DC Fast Charger (100kW)",
    power: 100,
    vehicleType: "both",
    connectorTypes: ["CCS", "Type 2"],
    pricing: { ratePerHour: 996, currency: "INR" },
    amenities: ["WiFi", "Restroom", "Parking"],
    is24x7: true
  },
  // Vellore
  {
    name: "Vellore IT Highway Station",
    location: {
      address: "Katpadi Road, Vellore",
      city: "Vellore",
      state: "Tamil Nadu",
      pincode: "632001",
      coordinates: { lat: 12.9165, lng: 79.1325 }
    },
    chargerType: "DC Fast Charger (150kW)",
    power: 150,
    vehicleType: "both",
    connectorTypes: ["CCS", "CHAdeMO", "Type 2"],
    pricing: { ratePerHour: 1245, currency: "INR" },
    amenities: ["WiFi", "Cafe", "Parking"],
    is24x7: true
  },
  // Bike-specific stations
  {
    name: "Chennai Bike Charge Point",
    location: {
      address: "Velachery Main Road",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600042",
      coordinates: { lat: 12.9756, lng: 80.2164 }
    },
    chargerType: "Level 2 (11kW)",
    power: 11,
    vehicleType: "bike",
    connectorTypes: ["Type 2"],
    pricing: { ratePerHour: 498, currency: "INR" },
    amenities: ["WiFi", "Parking"],
    is24x7: false
  },
  {
    name: "Coimbatore Two-Wheeler Hub",
    location: {
      address: "Avinashi Road, Peelamedu",
      city: "Coimbatore",
      state: "Tamil Nadu",
      pincode: "641004",
      coordinates: { lat: 11.0248, lng: 77.0036 }
    },
    chargerType: "Level 2 (11kW)",
    power: 11,
    vehicleType: "bike",
    connectorTypes: ["Type 2"],
    pricing: { ratePerHour: 498, currency: "INR" },
    amenities: ["Parking", "Restroom"],
    is24x7: false
  }
];

const seedDatabase = async () => {
  try {
    await connectDB();

    // Clear existing data
    await User.deleteMany({});
    await Station.deleteMany({});
    console.log('✅ Cleared existing data');

    // Placeholder provider that owns the demo stations (real providers register via the website)
    const demoProvider = await User.create({
      name: 'Demo Provider (For Seeded Stations)',
      email: 'demo.provider@system.internal',
      password: 'system-internal-only',
      role: 'provider',
      phone: '+91 0000000000',
      isVerified: true
    });

    await Station.create(tamilNaduStations.map(({ is24x7, ...stationData }) => ({
      ...stationData,
      providerId: demoProvider._id,
      providerName: demoProvider.name,
      operatingHours: { open: '00:00', close: '23:59', is24x7: is24x7 !== false },
      isVerified: true
    })));
    console.log(`✅ Created ${tamilNaduStations.length} charging stations across Tamil Nadu`);

    console.log('\n🎉 Database seeded successfully!');
    console.log('ℹ️  Create an admin with: npm run setup-admin');
    console.log('ℹ️  Users & providers register via the website\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
