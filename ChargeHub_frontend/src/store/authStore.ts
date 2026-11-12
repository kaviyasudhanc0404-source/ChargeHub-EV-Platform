import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'user' | 'provider' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  profilePicture?: string;
  defaultLocation?: string;
  defaultCoordinates?: { lat: number; lng: number };
  vehicleInfo?: {
    vehicleModel?: string;
    vehicleName?: string;
    vehicleType?: string;
    batteryCapacity?: string;
  };
  businessInfo?: {
    location?: string;
    upiId?: string;
  };
  hasPassword?: boolean; // false for accounts created with Google sign-in
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

// Single source of truth for the session (persisted to localStorage)
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
      updateUser: (updates) => set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),
    }),
    { name: 'auth-storage' }
  )
);

// Display name of each role (panel badge, profile)
export const ROLE_LABEL: Record<Role, string> = { user: 'Driver', provider: 'Provider', admin: 'Admin' };

// Landing page for each role after login
export const homePath = (role: Role) => `/${role}/dashboard`;
