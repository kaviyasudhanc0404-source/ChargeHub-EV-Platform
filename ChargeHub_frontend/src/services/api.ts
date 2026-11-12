import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import type { Station } from '@/lib/stations';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

// Render's free plan puts an idle backend to sleep and takes up to about a minute to wake it. The site pings the
// health check as soon as it opens, and every other request waits for that ping, so nothing times out (or shows an
// error) while the server is starting; once it has answered, requests go straight through. If the tab sat idle long
// enough for the server to fall asleep again, the next request wakes it the same way.
const WAKE_TIMEOUT_MS = 90000;
const SLEEPS_AFTER_MS = 14 * 60 * 1000; // Render sleeps after 15 idle minutes
const HEALTH_PATH = '/health';
let serverAwake: Promise<unknown> | undefined;
let lastReplyAt = 0; // 0 while a wake-up ping is in flight (or the server has never answered)

export const wakeServer = () => {
  if (!serverAwake || (lastReplyAt && Date.now() - lastReplyAt > SLEEPS_AFTER_MS)) {
    lastReplyAt = 0;
    serverAwake = API.get(HEALTH_PATH, { timeout: WAKE_TIMEOUT_MS }).catch(() => undefined);
  }
  return serverAwake;
};

API.interceptors.request.use(async (config) => {
  if (config.url !== HEALTH_PATH) await wakeServer();
  const { token } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Expired/invalid session → log out and return to the login page
API.interceptors.response.use(
  (response) => {
    lastReplyAt = Date.now();
    return response;
  },
  (error) => {
    if (error.response) lastReplyAt = Date.now();
    const { token, logout } = useAuthStore.getState();
    if (error.response?.status === 401 && token) {
      logout();
      window.location.assign('/auth?expired=1');
    }
    return Promise.reject(error);
  }
);

type Role = 'user' | 'provider';

// ==================== AUTH ====================
export const authAPI = {
  register: (data: {
    name: string;
    email: string;
    password: string;
    role: Role;
    phone?: string;
    businessInfo?: { location?: string; upiId?: string };
  }) => API.post('/auth/register', data),
  login: (email: string, password: string) => API.post('/auth/login', { email, password }),
  googleAuth: (idToken: string, role: Role) => API.post('/auth/google', { idToken, role }),
  getMe: () => API.get('/auth/me'),
  updateProfile: (data: Record<string, unknown>) => API.put('/auth/update-profile', data),
  verifyPassword: (currentPassword: string) => API.post('/auth/verify-password', { currentPassword }),
  changePassword: (currentPassword: string, newPassword: string) => API.put('/auth/change-password', { currentPassword, newPassword }),
  deleteAccount: () => API.delete('/auth/me'),
};

// ==================== DASHBOARD STATS ====================
export const userAPI = {
  getStats: () => API.get('/users/stats'),
};

export const providerAPI = {
  getStats: () => API.get('/providers/stats'),
  getAnalytics: () => API.get('/providers/analytics'),
};

// ==================== ADMIN ====================
export const adminAPI = {
  getDashboardStats: () => API.get('/admin/stats'),
  getAnalytics: () => API.get('/admin/analytics'),
  getTransactions: (params?: { page?: number; limit?: number }) => API.get('/admin/transactions', { params }),
  getUsers: (params?: { role?: string; search?: string; page?: number; limit?: number }) => API.get('/admin/users', { params }),
  blockUser: (userId: string, isBlocked: boolean) => API.patch(`/admin/users/${userId}/block`, { isBlocked }),
  approveUser: (userId: string) => API.patch(`/admin/users/${userId}/approve`),
  deleteUser: (userId: string) => API.delete(`/admin/users/${userId}`),
  addAdmin: (data: { name: string; email: string; password: string }) => API.post('/admin/users/admin', data),
  getStations: (params?: { isVerified?: boolean; page?: number; limit?: number }) => API.get('/admin/stations', { params }),
  verifyStation: (stationId: string, isVerified: boolean) => API.patch(`/admin/stations/${stationId}/verify`, { isVerified }),
  getSettings: () => API.get('/admin/settings'),
  updateSettings: (data: Record<string, unknown>) => API.put('/admin/settings', data),
};

// ==================== STATIONS ====================
export const stationAPI = {
  getAllStations: (params?: { city?: string; state?: string; vehicleType?: string }) => API.get('/stations', { params }),
  getNearby: ({ lat, lng }: LatLng) => API.get('/stations/nearby', { params: { lat, lng } }),
  getPublicStats: () => API.get('/stations/stats'),
  getMyStations: () => API.get('/stations/mine'),
  createStation: (data: Record<string, unknown>) => API.post('/stations', data),
  updateStation: (id: string, data: Record<string, unknown>) => API.put(`/stations/${id}`, data),
  setAvailability: (id: string, isAvailable: boolean) => API.patch(`/stations/${id}/availability`, { isAvailable }),
  deleteStation: (id: string) => API.delete(`/stations/${id}`),
};

// ==================== BOOKINGS ====================
// A start time in the booking picker: free, inside another booking, or too close to the next one for the chosen duration
export type SlotStatus = 'open' | 'booked' | 'clash';
// The check-in code a customer currently holds: when it stops working and when a new one may be sent
export interface OtpState {
  expiresAt: string;
  resendAt: string;
}
export interface AvailabilityDay {
  date: string; // YYYY-MM-DD (IST)
  slots: { time: string; status: SlotStatus }[];
}

export const bookingAPI = {
  createBooking: (data: {
    stationId: string;
    vehicleInfo: { vehicleName: string; vehicleType: 'car' | 'bike' };
    bookingDate: string;
    bookingTime: string;
    duration: number;
  }) => API.post('/bookings', data),
  getAvailability: (stationId: string, duration: number) =>
    API.get<{ data: AvailabilityDay[] }>(`/bookings/availability/${stationId}`, { params: { duration } }),
  getUserBookings: () => API.get('/bookings/my-bookings', { params: { limit: 100 } }),
  getProviderBookings: () => API.get('/bookings/provider', { params: { limit: 100 } }),
  cancelBooking: (id: string, reason?: string) => API.patch(`/bookings/${id}/cancel`, { reason }),
  rateBooking: (id: string, stars: number, review?: string) => API.post(`/bookings/${id}/rate`, { stars, review }),
  deleteBooking: (id: string) => API.delete(`/bookings/${id}`),
  // Sending waits for the mail server, which can be slow
  sendOTP: (id: string) => API.post<{ message: string; data: OtpState & { otp?: string } }>(`/bookings/${id}/otp`, undefined, { timeout: 45000 }),
  verifyOTP: (id: string, data: { otp: string; energyConsumed?: number }) => API.post(`/bookings/${id}/verify`, data),
};

// ==================== REPORTS ====================
export const reportAPI = {
  create: (data: { category: string; subject: string; message: string; stationId?: string }) => API.post('/reports', data),
  getAll: () => API.get('/reports'),
  resolve: (id: string, adminNote?: string) => API.patch(`/reports/${id}/resolve`, { adminNote }),
  remove: (id: string) => API.delete(`/reports/${id}`),
};

// ==================== MISC ====================
export type LatLng = { lat: number; lng: number };
export interface PlaceSuggestion extends LatLng {
  label: string;
}
export interface StationAddress {
  address: string;
  city: string;
  state: string;
}
// A station pin checked against its address: the pin's place name, where the address points (`code` when a plus code
// names the exact spot) and how far apart they are when they disagree
export interface PinCheck {
  place: string | null;
  target: (PlaceSuggestion & { code?: string }) | null;
  mismatch: { kind: 'plusCode' | 'area'; km: number; message: string } | null;
}

export const geoAPI = {
  search: (q: string, near?: LatLng | null, signal?: AbortSignal) =>
    API.get<{ data: PlaceSuggestion[] }>('/geocode/search', { params: { q, ...(near && { lat: near.lat, lng: near.lng }) }, signal }),
  // area: name only the town/district ("Around Coimbatore, Tamil Nadu"), for a location that is only known roughly
  reverse: ({ lat, lng }: LatLng, area = false) => API.get<{ data: PlaceSuggestion }>('/geocode/reverse', { params: { lat, lng, ...(area && { area: 1 }) } }),
  checkPin: (address: StationAddress, pin: LatLng | null) =>
    API.get<{ data: PinCheck }>('/geocode/check-pin', { params: { ...address, ...(pin && { lat: pin.lat, lng: pin.lng }) } }),
};

export const notificationAPI = {
  getAll: () => API.get('/notifications'),
};

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  context?: string;
}
// The assistant's answer; live-data answers also carry station cards, or ask for a sign-in or the user's location
export interface ChatReply {
  reply: string;
  stations?: Station[];
  fromLabel?: string;
  context?: string;
  needsLogin?: boolean;
  needsLocation?: boolean;
}

export const chatAPI = {
  send: (messages: ChatTurn[], location?: LatLng | null) =>
    API.post<{ data: ChatReply }>('/chat', { messages, ...(location && { location: { lat: location.lat, lng: location.lng } }) }, { timeout: 45000 }),
};
