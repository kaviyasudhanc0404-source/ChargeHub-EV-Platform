const mongoose = require('mongoose');
const { plusCodeMismatch } = require('../services/stationPin.service');

const stationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Station name is required'],
    trim: true
  },
  location: {
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    pincode: String,
    coordinates: {
      lat: {
        type: Number,
        required: true,
        min: -90,
        max: 90
      },
      lng: {
        type: Number,
        required: true,
        min: -180,
        max: 180
      }
    },
    // GeoJSON copy of coordinates for geospatial queries (kept in sync automatically)
    point: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: [Number] // [lng, lat]
    }
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  providerName: {
    type: String,
    required: true
  },
  chargerType: {
    type: String,
    required: true,
    enum: ['Level 1 (3kW)', 'Level 2 (11kW)', 'Level 2 (22kW)', 'DC Fast Charger (50kW)', 'DC Fast Charger (100kW)', 'DC Fast Charger (150kW)', 'DC Ultra Fast (350kW)']
  },
  power: {
    type: Number,
    required: true // in kW
  },
  vehicleType: {
    type: String,
    enum: ['car', 'bike', 'both'],
    default: 'both'
  },
  connectorTypes: [{
    type: String,
    enum: ['Type 1', 'Type 2', 'CCS', 'CHAdeMO', 'GB/T']
  }],
  pricing: {
    ratePerHour: {
      type: Number,
      required: true, // in INR
      min: 1
    },
    currency: {
      type: String,
      default: 'INR'
    }
  },
  // Provider-controlled online/offline switch (bookings are checked per time slot)
  availability: {
    isAvailable: {
      type: Boolean,
      default: true
    }
  },
  amenities: [{
    type: String,
    enum: ['WiFi', 'Restroom', 'Cafe', 'Parking', 'Shopping', 'Restaurant']
  }],
  operatingHours: {
    open: {
      type: String,
      default: '00:00'
    },
    close: {
      type: String,
      default: '23:59'
    },
    is24x7: {
      type: Boolean,
      default: true
    }
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  totalBookings: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

stationSchema.index({ 'location.point': '2dsphere' });
stationSchema.index({ isActive: 1, isVerified: 1 });
stationSchema.index({ providerId: 1 });

stationSchema.pre('validate', function (next) {
  // The pin must agree with a plus code in the address, whichever code path saves the station
  if (this.isNew || this.isModified('location.coordinates') || this.isModified('location.address')) {
    const mismatch = plusCodeMismatch(this.location || {});
    if (mismatch) this.invalidate('location.coordinates', mismatch.message);
  }

  const { lat, lng } = this.location?.coordinates || {};
  if (typeof lat === 'number' && typeof lng === 'number') {
    this.location.point = { type: 'Point', coordinates: [lng, lat] };
  }
  next();
});

// Fill the GeoJSON point for stations saved before it existed (idempotent, run at startup)
stationSchema.statics.ensureGeoPoints = function () {
  return this.updateMany(
    { 'location.point.coordinates.1': { $exists: false } },
    [{ $set: { 'location.point': { type: 'Point', coordinates: ['$location.coordinates.lng', '$location.coordinates.lat'] } } }]
  );
};

module.exports = mongoose.model('Station', stationSchema);
