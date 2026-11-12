# ChargeHub Backend – API Reference

Node.js + Express + Mongoose on **MongoDB Atlas**. Setup, environment variables and deployment are described in the
[root README](../README.md).

## Structure

```
ChargeHub_backend/
├── server.js                 # App setup, routes, startup, no-show expiry job
├── config/db.js              # Atlas connection
├── middleware/               # auth (JWT + roles + maintenance mode), validation, errors
├── models/                   # User, Station, Booking, Payment, Report, Settings, Place, CacheEntry
├── controllers/              # Request handlers (one file per area)
├── routes/                   # Route definitions + input validation
├── services/                 # email (OTP), geocoding (Photon/Nominatim), routing (OpenRouteService/OSRM)
├── utils/                    # stats (IST), cache (MongoDB TTL), plus codes, geo maths, text normalization
├── seed.js                   # Demo stations (⚠️ wipes users & stations)
├── setupAdmin.js             # Create / promote an admin
└── importPlaces.js           # Load the GeoNames place gazetteer (npm run import-places)
```

All responses are JSON: `{ success, message?, data? }`. Errors return `{ success: false, message }` with a proper
status code (400 invalid input, 401 not logged in, 403 not allowed, 404 not found, 409 conflict, 422 validation,
429 rate limited, 503 maintenance).

## Endpoints (base: `/api`)

### Auth
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register user or provider (`businessInfo` for providers) |
| POST | `/auth/login` | Public | Email + password login |
| POST | `/auth/google` | Public | Google sign-in with a Firebase ID token (`idToken`, `role`) |
| GET | `/auth/me` | Logged in | Current user |
| PUT | `/auth/update-profile` | Logged in | Update profile details |
| POST | `/auth/verify-password` | Logged in | Confirm the current password (step 1 of a password change) |
| PUT | `/auth/change-password` | Logged in | Set a new password; the current password is checked again |
| DELETE | `/auth/me` | User, Provider | Delete own account (cancels upcoming bookings) |

### Stations
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/stations?city=&state=&vehicleType=` | Public | Approved stations |
| GET | `/stations/nearby?lat=&lng=&limit=` | Public | Nearest approved stations (anywhere in India) with road distance/time for the closest 25 |
| GET | `/stations/stats` | Public | Landing-page figures |
| GET | `/stations/mine` | Provider | Own stations incl. pending approval |
| POST | `/stations` | Provider | Create (always pending admin approval) |
| PUT | `/stations/:id` | Owner, Admin | Update allowed fields |
| PATCH | `/stations/:id/availability` | Owner, Admin | Online / offline |
| DELETE | `/stations/:id` | Owner, Admin | Soft delete |

### Bookings (time slots, pay at station)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/bookings` | User | Book a slot (overlap, opening hours, 30-day window checked) |
| GET | `/bookings/availability/:stationId?duration=` | User | Bookable start times for the next 30 days (open / booked / clash) |
| GET | `/bookings/my-bookings` | User | Own bookings |
| PATCH | `/bookings/:id/cancel` | User | Cancel before the slot starts |
| POST | `/bookings/:id/rate` | User | Rate a completed session (1–5) |
| GET | `/bookings/provider` | Provider | Bookings at own stations |
| POST | `/bookings/:id/otp` | Provider | Email a check-in OTP (from 30 min before the slot) |
| POST | `/bookings/:id/verify` | Provider | Verify OTP → session completed, cash payment recorded |
| DELETE | `/bookings/:id` | Provider, Admin | Remove a past booking from history |

### Dashboards
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/users/stats` | User | Dashboard + payment history |
| GET | `/providers/stats` | Provider | Dashboard, earnings and profile figures |
| GET | `/providers/analytics` | Provider | Monthly bookings, usage by time of day, station performance |
| GET | `/notifications` | Logged in | Role-specific notifications derived from live data |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/stats` | Dashboard figures |
| GET | `/admin/analytics` | Growth, monthly bookings, top providers, charger split |
| GET | `/admin/transactions` | Payments + monthly revenue |
| GET | `/admin/users?role=&search=` | Users / providers / admins |
| POST | `/admin/users/admin` | Add admin |
| PATCH | `/admin/users/:id/block` · `/approve` | Block / unblock, approve |
| DELETE | `/admin/users/:id` | Delete (provider's stations go offline) |
| GET | `/admin/stations?isVerified=` | All stations |
| PATCH | `/admin/stations/:id/verify` | Approve / revoke |
| GET · PUT | `/admin/settings` | Registration switches, maintenance mode, platform fee |

### Reports
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/reports` | User, Provider | Report an issue |
| GET | `/reports?status=` | Admin | List reports |
| PATCH | `/reports/:id/resolve` | Admin | Resolve with an optional note (reporter is notified) |
| DELETE | `/reports/:id` | Admin | Delete |

### Location & assistant
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/geocode/search?q=&lat=&lng=` | Public | Up to 6 place suggestions anywhere in India (towns, villages, landmarks, addresses, plus codes), ranked by match and closeness |
| GET | `/geocode/reverse?lat=&lng=` | Public | Place name for a point |
| POST | `/chat` | Anyone (live-data answers need login) | "Ask Me" assistant (Gemini): EV questions for everyone; nearby stations, charge time/cost and bookings for signed-in users; one image per message |
| GET | `/health` | Public | Health check (use for uptime monitoring) |

## Booking lifecycle

`confirmed` → provider sends OTP → user shares it → provider verifies → `completed` (payment recorded, `paid`).
Users can cancel before the slot (`cancelled`). Confirmed bookings 30 minutes past their slot become `no-show`
automatically (checked every 10 minutes).

## Location services

- **Search** merges three sources: the `places` gazetteer in MongoDB (GeoNames: all 40,444 Tamil Nadu villages/towns + larger
  towns in India, loaded with `npm run import-places`), Photon (OpenStreetMap addresses/landmarks) and Nominatim (fallback).
  Ranking: how well the full address matches (small spelling differences allowed, the word being typed may be partial),
  then Tamil Nadu first, then towns/villages before single buildings, then closeness to the user. Same-named results
  within 15 km are shown once. Google plus codes (e.g. `C6FH+9XW Ukkaram`) are decoded locally to the exact point.
- **User location**: the saved default (`defaultLocation` + exact `defaultCoordinates`) is used first; device GPS is used
  when there is no default or on request, and a fix worse than ±1 km must be confirmed by the user.
- **Road distance**: OpenRouteService matrix (`ORS_API_KEY`) → OSRM public server → estimate (straight line × 1.3, labelled).
  Only the 25 nearest stations (by straight line, via a 2dsphere index) are routed.
- **Caching**: search 7 days, reverse 30 days, routes 24 h per ~100 m origin cell, stored in the `cacheentries`
  collection and expired automatically by MongoDB.

## Security notes

- JWT sessions (7 days); passwords hashed with bcrypt; OTPs are random, HMAC-hashed and limited to 5 attempts
- Providers can only set whitelisted station fields; approval, ratings and revenue are server-controlled
- Rate limits: 300 requests / 15 min per IP, 20 auth attempts / 15 min, 40 chat messages / 15 min, 150 location lookups / 15 min
- Error details are hidden in production (`NODE_ENV=production`)
