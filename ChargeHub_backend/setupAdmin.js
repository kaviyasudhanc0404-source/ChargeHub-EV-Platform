// Create an admin, or promote/reset an existing account to admin.
// Usage: npm run setup-admin -- <email> <password> [name]
const mongoose = require('mongoose');
const { isEmail } = require('validator');
const connectDB = require('./config/db');
const User = require('./models/User.model');

const [email, password, name = 'Admin'] = process.argv.slice(2);

async function setupAdmin() {
  if (!email || !isEmail(email) || !password || password.length < 6) {
    console.error('Usage: npm run setup-admin -- <email> <password (min 6 chars)> [name]');
    process.exit(1);
  }

  await connectDB();
  let user = await User.findByEmail(email);
  if (user) {
    user.set({ role: 'admin', password, isActive: true, isVerified: true });
  } else {
    user = new User({ name, email: email.trim().toLowerCase(), password, role: 'admin', isVerified: true });
  }
  await user.save();
  console.log(`✅ Admin ready: ${user.email}`);
}

setupAdmin()
  .catch((err) => {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
