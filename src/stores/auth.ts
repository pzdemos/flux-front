import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthStore {
  token: string | null;
  user: { username: string } | null;
  isAuthenticated: boolean;
  login: (token: string, username: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: (token: string, username: string) => {
        localStorage.setItem('flux_token', token);
        set({ token, user: { username }, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem('flux_token');
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'flux_auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
