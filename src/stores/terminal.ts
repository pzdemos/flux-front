import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TerminalTab } from '@/types';

interface TerminalStore {
  tabs: TerminalTab[];
  activeTabId: string | null;
  nextId: number;

  addTab: () => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<TerminalTab>) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  closeOtherTabs: (keepId: string) => void;
  closeAllTabs: () => void;
}

let tabCounter = 0;
const generateId = () => `tab-${Date.now()}-${++tabCounter}`;

export const useTerminalStore = create<TerminalStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      nextId: 0,

      addTab: () => {
        const id = generateId();
        const newTab: TerminalTab = {
          id,
          title: `终端 ${++get().nextId}`,
          sessionId: null,
          status: 'DISCONNECTED',
          createdAt: Date.now(),
        };
        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: id,
        }));
        return id;
      },

      removeTab: (id: string) => {
        const { tabs, activeTabId } = get();
        const idx = tabs.findIndex((t) => t.id === id);
        if (idx === -1) return;
        
        const newTabs = tabs.filter((t) => t.id !== id);
        let newActiveId = activeTabId;
        
        if (activeTabId === id) {
          if (newTabs.length > 0) {
            newActiveId = newTabs[Math.min(idx, newTabs.length - 1)].id;
          } else {
            newActiveId = null;
          }
        }
        
        set({ tabs: newTabs, activeTabId: newActiveId });
      },

      setActiveTab: (id: string) => set({ activeTabId: id }),

      updateTab: (id: string, updates: Partial<TerminalTab>) =>
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      reorderTabs: (fromIndex: number, toIndex: number) =>
        set((state) => {
          const newTabs = [...state.tabs];
          const [moved] = newTabs.splice(fromIndex, 1);
          newTabs.splice(toIndex, 0, moved);
          return { tabs: newTabs };
        }),

      closeOtherTabs: (keepId: string) =>
        set((state) => ({
          tabs: state.tabs.filter((t) => t.id === keepId),
          activeTabId: keepId,
        })),

      closeAllTabs: () => set({ tabs: [], activeTabId: null }),
    }),
    {
      name: 'flux_terminal',
      partialize: (state) => ({
        nextId: state.nextId,
      }),
    }
  )
);

interface TerminalSettingsStore {
  fontSize: number;
  fontFamily: string;
  theme: 'dark' | 'light';
  cursorBlink: boolean;
  scrollback: number;
  enableLigatures: boolean;

  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setCursorBlink: (blink: boolean) => void;
  setScrollback: (lines: number) => void;
  setEnableLigatures: (enabled: boolean) => void;
}

export const useTerminalSettings = create<TerminalSettingsStore>()(
  persist(
    (set) => ({
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: 'dark',
      cursorBlink: true,
      scrollback: 10000,
      enableLigatures: true,

      setFontSize: (size) => set({ fontSize: Math.max(8, Math.min(24, size)) }),
      setFontFamily: (family) => set({ fontFamily: family }),
      setTheme: (theme) => set({ theme }),
      setCursorBlink: (blink) => set({ cursorBlink: blink }),
      setScrollback: (lines) => set({ scrollback: lines }),
      setEnableLigatures: (enabled) => set({ enableLigatures: enabled }),
    }),
    {
      name: 'flux_terminal_settings',
    }
  )
);
