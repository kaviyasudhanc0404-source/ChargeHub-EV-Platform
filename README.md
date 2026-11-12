# ChargeHub ⚡ - EV Charging Management System

ChargeHub lets EV drivers find and book charging slots, providers manage their chargers and collect payment at the
station, and admins approve stations, handle reports and monitor the platform. Location search, maps and road distances
work for every town, village and address in India.

| Part | Folder | Stack | Runs on |
|------|--------|-------|---------|
| Backend API | `ChargeHub_backend/` | Node.js 22, Express, Mongoose, **MongoDB Atlas** | http://localhost:5000 |
| Frontend | `ChargeHub_frontend/` | React, TypeScript, Vite, Tailwind, shadcn/ui, Leaflet | http://localhost:8080 |

External services (all free tiers):

| Service | Used for | Key |
|---|---|---|
| MongoDB Atlas | Database (also caches location and distance lookups) | connection string |
| Firebase Authentication | Google sign-in | web config + project ID |
| Brevo | Booking OTP emails | API key |
| Google Gemini API | "Ask Me" assistant | API key |
| OpenStreetMap tiles | Street map (Leaflet) | none |
| GeoNames | Tamil Nadu village/town gazetteer, loaded into MongoDB (CC BY 4.0) | none |
| Photon + Nominatim | Address/landmark search across India | none |
| OpenRouteService | Road distance and drive time | free key |
| OSRM public server | Road distance fallback | none |

## Features

- **Anyone** – open the station map at `/stations` without an account; booking asks them to sign in and then returns
  them to the map with the booking form open
- **Users** – use their current location ("My location", like map apps) or a searched place, plus code or map pin, and
  optionally save a default; see road distance and drive time to the nearest stations, book a time slot, pay at the station,
  rate sessions, download receipts, report issues, chat with the assistant
- **Providers** – add chargers with an exact map pin and opening hours, toggle online/offline, verify sessions with an
  emailed OTP, see earnings and analytics, export CSV
- **Admins** – approve stations and providers, manage users/admins, view analytics and transactions, resolve reports,
  configure registration, maintenance mode and the platform fee

## 1. Backend

```bash
cd ChargeHub_backend
npm install
cp .env.example .env      # fill in the values (see below)
npm run dev               # or: npm start
npm run setup-admin -- admin@example.com "StrongPassword" "Admin Name"   # first admin
npm run import-places     # once: loads the Tamil Nadu place gazetteer (GeoNames) used by location search
```

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Atlas connection string (database `chargehub`) |
| `JWT_SECRET` | Long random string – `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `FRONTEND_URL` | Allowed frontend origin(s), comma-separated |
| `BREVO_API_KEY`, `EMAIL_FROM` | OTP emails through Brevo's API (`EMAIL_FROM` must be a sender verified in Brevo) |
| `FIREBASE_PROJECT_ID` | Firebase project used for Google sign-in |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Assistant (key from https://aistudio.google.com/apikey) |
| `ORS_API_KEY` | Road distances (free key from https://openrouteservice.org/dev/#/signup) |

`npm run seed` inserts demo stations but **deletes all users and stations first** – only use it on an empty database.

## 2. Frontend

```bash
cd ChargeHub_frontend
npm install
cp .env.example .env      # VITE_API_URL + Firebase web config
npm run dev
```

## Google sign-in (Firebase)

1. Firebase console → Authentication → Sign-in method → enable **Google**.
2. Authentication → Settings → **Authorized domains**: add your deployed frontend domain (`localhost` is allowed by default).
3. Put the web app config in the frontend `.env` and the project ID in the backend `FIREBASE_PROJECT_ID`.

The browser signs in with Google through Firebase and sends the ID token to `POST /api/auth/google`; the backend
verifies it and issues the normal ChargeHub session.

## Deployment (Render + Vercel, free plans)

Push the whole project (this folder) to one GitHub repository. `.env` files are git-ignored: the real values go into the
Render and Vercel dashboards, never into git. Rotate any credential that has been shared or committed before going live.

### 1. MongoDB Atlas

Network Access → add `0.0.0.0/0` (Render's free plan has no fixed outbound IP). Keep a strong database password.

### 2. Backend on Render

1. Render dashboard → **New → Blueprint** → pick the repository. [`render.yaml`](render.yaml) creates the
   `chargehub-api` web service (free plan, `ChargeHub_backend/` folder, Node 22, health check `/api/health`,
   `NODE_ENV=production`, a generated `JWT_SECRET`).
2. Fill in the values it asks for (same meaning as in `ChargeHub_backend/.env.example`). For `FRONTEND_URL`, enter the Vercel URL
   from step 3. If you don't know it yet, enter `http://localhost:8080` for now and update it afterwards (saving an
   environment variable redeploys the service).
3. Note the service URL, e.g. `https://chargehub-api.onrender.com`, and open `/api/health` on it. It should return
   `"status":"OK"`.

The server refuses to start with a clear log message if `MONGODB_URI`, `JWT_SECRET` (32+ characters) or `FRONTEND_URL`
is missing, and logs a warning for each optional feature that isn't configured. On first start it also fills in small
fields older records lack (booking slot times, email keys). Run `npm run setup-admin` and `npm run import-places` from
your own computer against the same `MONGODB_URI`; they don't need to run on Render.

**Free plan behaviour:** the service sleeps after 15 minutes without traffic and takes up to about a minute to wake. The
site sends a wake-up request as soon as it opens, and every API call waits for it, so the first page shows its loading
state instead of an error. To avoid the wait entirely, an external uptime monitor can request `/api/health` every 10
minutes (one always-on service fits in Render's 750 free hours per month).

### 3. Frontend on Vercel

1. Vercel → **Add New → Project** → import the repository → **Root Directory: `ChargeHub_frontend`**. Framework,
   build command and output folder come from [`vercel.json`](ChargeHub_frontend/vercel.json).
2. Environment Variables: `VITE_API_URL=https://<your-render-service>.onrender.com/api` plus the four
   `VITE_FIREBASE_*` values from `ChargeHub_frontend/.env.example`. The build stops with an error if `VITE_API_URL`
   is missing, so the site can never silently call `localhost`. These values are built into the site, so redeploy
   after changing one.
3. Deploy, then put the Vercel URL (e.g. `https://chargehub.vercel.app`, no trailing slash needed) into Render's
   `FRONTEND_URL`. Only the URLs listed there may call the API: add a custom domain there too if you use one.

`vercel.json` also sends every page path to `index.html` (so refreshing any page works), caches the hashed
`/assets` files for a year and adds basic security headers.

### 4. After both are live

- **Firebase** → Authentication → Settings → Authorized domains: add the Vercel domain (Google sign-in).
- **Brevo**: `EMAIL_FROM` must be a verified sender. If OTP emails fail with a 401, allow Render's IPs in Brevo →
  Security → Authorized IPs (or turn that blocking off).
- **HTTPS**: browsers only share the device location with HTTPS sites; Vercel and Render both serve HTTPS.
- **Distances**: OpenRouteService's free plan has a daily request limit. Results are cached for 24 h per ~100 m area,
  and when the limit is reached the OSRM public server (then a clearly marked estimate) is used automatically.

API reference: [ChargeHub_backend/README.md](ChargeHub_backend/README.md)
