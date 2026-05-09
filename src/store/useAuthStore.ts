import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  name: string;
}

interface AuthState {
  /** The raw magic link token (UUID), stored permanently so we can re-auth silently */
  pass: string | null;
  /** Short-lived JWT (7 days) */
  token: string | null;
  user: AuthUser | null;

  setAuth: (pass: string, token: string, user: AuthUser) => void;
  setToken: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      pass: null,
      token: null,
      user: null,

      setAuth: (pass, token, user) => set({ pass, token, user }),
      setToken: (token, user) => set({ token, user }),
      logout: () => set({ pass: null, token: null, user: null }),
    }),
    { name: 'wt_auth' }
  )
);
