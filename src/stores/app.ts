import { create } from 'zustand';
import type { DeviceType, ViewMode, Notification } from '@/types';

interface AppStore {
  activeModule: string;
  viewMode: ViewMode;
  sidebarOpen: boolean;
  deviceType: DeviceType;
  isMobile: boolean;
  notifications: Notification[];
  globalLoading: boolean;

  setViewMode: (mode: ViewMode) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setDeviceType: (type: DeviceType) => void;
  addNotification: (n: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  setGlobalLoading: (loading: boolean) => void;
}

let notifCounter = 0;

export const useAppStore = create<AppStore>((set, get) => ({
  activeModule: 'files',
  viewMode: 'files',
  sidebarOpen: true,
  deviceType: 'desktop',
  isMobile: false,
  notifications: [],
  globalLoading: false,

  setViewMode: (mode) => set({ viewMode: mode }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  setDeviceType: (type) =>
    set({
      deviceType: type,
      isMobile: type === 'mobile',
      sidebarOpen: type === 'desktop',
    }),

  addNotification: (n) => {
    const id = `notif-${Date.now()}-${++notifCounter}`;
    const notification: Notification = { ...n, id };
    set((s) => ({ notifications: [...s.notifications, notification] }));
    if (n.duration !== 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, n.duration || 3000);
    }
  },

  removeNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

  setGlobalLoading: (loading) => set({ globalLoading: loading }),
}));
