import { create } from 'zustand';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: 'owner' | 'admin' | 'member' | 'guest' | 'client';
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),

  fetchCurrentUser: async () => {
    try {
      set({ isLoading: true });
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const user = await res.json();
        set({ user, isAuthenticated: !!user, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    set({ user: null, isAuthenticated: false, isLoading: false });
    window.location.href = '/login';
  },
}));
