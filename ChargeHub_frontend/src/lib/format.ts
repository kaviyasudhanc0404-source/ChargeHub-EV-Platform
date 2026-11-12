const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const formatINR = (amount: number) => inr.format(amount || 0);

// Bookings and payments happen in India, so dates and times are always shown in IST, wherever the browser is
const IST = "Asia/Kolkata";

export const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST });

export const formatDateTime = (value: string | Date) =>
  new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: IST });

// Times are shown on the 12-hour clock: "14:30" → "2:30 PM"
export const formatClock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

// A moment's IST time on the 12-hour clock, e.g. "2:30 PM"
export const formatTime = (value: string | Date) =>
  formatClock(new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: IST }));

// Day, month, year and weekday of a moment in IST, e.g. for a calendar-style date stub
export const istDay = (value: string | Date) => {
  const date = new Date(value);
  const part = (options: Intl.DateTimeFormatOptions) => date.toLocaleString("en-IN", { timeZone: IST, ...options });
  return { day: part({ day: "numeric" }), month: part({ month: "short" }), year: part({ year: "numeric" }), weekday: part({ weekday: "short" }) };
};

export const formatDuration = (minutes: number) =>
  minutes < 1 ? "< 1 min" : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

export const formatAccuracy = (metres: number) =>
  metres >= 10000 ? `±${Math.round(metres / 1000)} km` : metres >= 1000 ? `±${(metres / 1000).toFixed(1)} km` : `±${metres} m`;

export const getInitials = (name = "") =>
  name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2) || "U";

type ApiError = { response?: { data?: { message?: string; reason?: string } } };

export const errorMessage = (error: unknown, fallback = "Something went wrong") => (error as ApiError)?.response?.data?.message || fallback;

// Machine-readable reason sent with some API errors (e.g. "PIN_CONFIRM")
export const errorReason = (error: unknown) => (error as ApiError)?.response?.data?.reason;

// "3.4 km" by road, "≈ 3.4 km" when estimated; under 100 m the station is right where you are
export const formatDistance = (km: number, method: "road" | "estimate" | "straight") =>
  km < 0.1 ? "< 0.1 km" : `${method === "road" ? "" : "≈ "}${km} km`;

// The account's real photo (e.g. from Google); without one, avatars show the person's initials
export const avatarUrl = (user?: { profilePicture?: string } | null) => user?.profilePicture || undefined;

export const VEHICLE_TEXT = { car: "Car", bike: "Bike", both: "Car & bike" } as const;

// "DC Fast · 50 kW" / "AC · 11 kW"
export const chargerLabel = (powerKw: number) => `${powerKw >= 50 ? "DC Fast" : "AC"} · ${powerKw} kW`;
