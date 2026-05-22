import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TerminalTabInfo {
  id: string;
  title: string;
  sessionId: string;
  status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'RECONNECTING' | 'ERROR';
  createdAt: number;
}

interface TerminalStore {
  tabs: TerminalTabInfo[];
  activeTabId: string | null;

  setTabs: (sessions: { name: string }[]) => void;
  addTab: (sessionName: string) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabStatus: (id: string, status: TerminalTabInfo['status']) => void;
  clearTabs: () => void;
}

let tabCounter = 0;
const generateId = () => `tab-${Date.now()}-${++tabCounter}`;

export const useTerminalStore = create<TerminalStore>()((set, get) => ({
  tabs: [],
  activeTabId: null,

  setTabs: (sessions) => {
    const current = get().tabs;
    const newTabs = sessions.map(s => {
      const existing = current.find(t => t.sessionId === s.name);
      return existing || {
        id: generateId(),
        title: s.name === 'main' ? '终端' : s.name,
        sessionId: s.name,
        status: 'DISCONNECTED' as const,
        createdAt: Date.now(),
      };
    });
    const activeTabId = get().activeTabId;
    const newActive = newTabs.find(t => t.id === activeTabId)
      ? activeTabId
      : newTabs[0]?.id ?? null;
    set({ tabs: newTabs, activeTabId: newActive });
  },

  addTab: (sessionName) => {
    const id = generateId();
    const newTab: TerminalTabInfo = {
      id,
      title: sessionName === 'main' ? '终端' : sessionName,
      sessionId: sessionName,
      status: 'DISCONNECTED',
      createdAt: Date.now(),
    };
    set(state => ({ tabs: [...state.tabs, newTab], activeTabId: id }));
  },

  removeTab: (id) => {
    const { tabs, activeTabId } = get();
    const newTabs = tabs.filter(t => t.id !== id);
    let newActiveId = activeTabId;
    if (activeTabId === id) {
      const idx = tabs.findIndex(t => t.id === id);
      newActiveId = newTabs.length > 0
        ? newTabs[Math.min(idx, newTabs.length - 1)].id
        : null;
    }
    set({ tabs: newTabs, activeTabId: newActiveId });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTabStatus: (id, status) =>
    set(state => ({
      tabs: state.tabs.map(t => t.id === id ? { ...t, status } : t),
    })),

  clearTabs: () => set({ tabs: [], activeTabId: null }),
}));

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
