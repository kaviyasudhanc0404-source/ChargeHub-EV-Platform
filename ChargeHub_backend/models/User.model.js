const mongoose = require('mongoose');
const { normalizeEmail } = require('validator');

// The inbox an address delivers to (Gmail ignores dots and "+tags", for example). Emails are saved exactly as the user
// typed them; this key is what makes two spellings of one inbox the same account.
const inboxOf = (email) => normalizeEmail(String(email || '').trim()) || String(email || '').trim().toLowerCase();
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  emailKey: { type: String, unique: true, sparse: true }, // inboxOf(email), kept in step on save
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  // false for accounts created with Google sign-in: their stored password is random and unknown to the user
  hasPassword: {
    type: Boolean,
    default: true
  },
  phone: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'provider', 'admin'],
    default: 'user'
  },
  profilePicture: String,
  googleId: {
    type: String,
    index: { sparse: true }
  },
  vehicleInfo: {
    vehicleName: String,
    vehicleModel: String,
    vehicleType: {
      type: String,
      enum: ['car', 'bike', 'both']
    },
    batteryCapacity: String
  },
  defaultLocation: {
    type: String,
    trim: true,
    default: ''
  },
  // Exact point of the default location (set from search, map pin or GPS)
  defaultCoordinates: {
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 }
  },
  businessInfo: {
    location: String,
    upiId: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: Date
}, {
  timestamps: true
});

userSchema.index({ role: 1, createdAt: -1 });

userSchema.pre('validate', function (next) {
  if (this.isModified('email') || !this.emailKey) this.emailKey = inboxOf(this.email);
  next();
});

// Find an account by email however it is spelled. Accounts created before emailKey existed stored the inbox form as
// their email, so that is matched too.
const byEmail = (email) => {
  const key = inboxOf(email);
  return { $or: [{ emailKey: key }, { email: key }] };
};
userSchema.statics.findByEmail = function (email) {
  return this.findOne(byEmail(email));
};
userSchema.statics.emailTaken = function (email, exceptId) {
  return this.exists({ ...byEmail(email), ...(exceptId && { _id: { $ne: exceptId } }) });
};

// Accounts saved before emailKey existed get theirs (the startup backfill, like the other models' ensure* helpers)
userSchema.statics.ensureEmailKeys = async function () {
  const missing = await this.find({ emailKey: { $exists: false } }, 'email').lean();
  if (!missing.length) return;
  await this.bulkWrite(missing.map(u => ({ updateOne: { filter: { _id: u._id }, update: { $set: { emailKey: inboxOf(u.email) } } } })), { ordered: false });
};

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Shape returned to the client after login/registration
userSchema.methods.toAuthJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    phone: this.phone,
    profilePicture: this.profilePicture,
    defaultLocation: this.defaultLocation,
    defaultCoordinates: this.defaultCoordinates,
    vehicleInfo: this.vehicleInfo,
    businessInfo: this.businessInfo,
    hasPassword: this.hasPassword
  };
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailKey;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
