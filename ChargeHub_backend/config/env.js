// Settings checked once at startup, so a misconfigured deploy fails with a clear message instead of on every request
const REQUIRED = ['MONGODB_URI', 'JWT_SECRET'];
const MIN_SECRET_LENGTH = 32;
const OPTIONAL = {
  BREVO_API_KEY: 'booking OTP emails',
  EMAIL_FROM: 'booking OTP emails (needs a sender verified in Brevo)',
  FIREBASE_PROJECT_ID: 'Google sign-in',
  GEMINI_API_KEY: 'the Ask Me assistant',
  ORS_API_KEY: 'OpenRouteService road distances (the free OSRM server is used instead)'
};

module.exports = function checkEnv() {
  const production = process.env.NODE_ENV === 'production';
  const missing = REQUIRED.filter(key => !process.env[key]);
  if (production && !process.env.FRONTEND_URL) missing.push('FRONTEND_URL'); // otherwise the browser blocks the deployed site
  if (missing.length) throw new Error(`Missing required settings: ${missing.join(', ')} (see backend/.env.example)`);
  if (production && process.env.JWT_SECRET.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production`);
  }
  Object.entries(OPTIONAL)
    .filter(([key]) => !process.env[key])
    .forEach(([key, feature]) => console.warn(`⚠️  ${key} is not set: ${feature} will not work`));
};
