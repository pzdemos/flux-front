import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/api/client';

interface UserSettings {
  files_root: string;
  ecs_region: string;
  sg_region: string;
  disk_region: string;
  node_path: string;
  skill_path: string;
}

interface AuthStore {
  token: string | null;
  user: { username: string } | null;
  isAuthenticated: boolean;
  settings: UserSettings | null;

  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      settings: null,

      login: async (username, password) => {
        const res = await apiClient.post('/auth/login', { username, password });
        const { token } = res.data as { token: string };
        localStorage.setItem('flux_token', token);
        set({
          token,
          user: { username },
          isAuthenticated: true,
        });
        // 登录后加载用户设置
        await get().loadSettings();
      },

      logout: () => {
        localStorage.removeItem('flux_token');
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          settings: null,
        });
      },

      loadSettings: async () => {
        try {
          const res = await apiClient.get('/user/settings');
          set({ settings: res.data as UserSettings });
        } catch {
          // 加载失败使用默认值
          set({
            settings: {
              files_root: '/var/server',
              ecs_region: 'cn-hangzhou',
              sg_region: 'cn-hangzhou',
              disk_region: 'cn-hangzhou',
              node_path: '/root',
              skill_path: '/root/.skill',
            },
          });
        }
      },

      updateSettings: async (newSettings) => {
        try {
          const res = await apiClient.put('/user/settings', newSettings);
          set({ settings: res.data as UserSettings });
        } catch (err) {
          throw err;
        }
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
