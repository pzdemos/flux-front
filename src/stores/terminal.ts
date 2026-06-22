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
  // 自定义标题映射：sessionId → custom title（持久化，与后端 session 解耦）
  customTitles: Record<string, string>;

  setTabs: (sessions: { name: string }[]) => void;
  addTab: (sessionName: string) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabStatus: (id: string, status: TerminalTabInfo['status']) => void;
  setCustomTitle: (sessionId: string, title: string) => void;
  clearCustomTitle: (sessionId: string) => void;
  clearTabs: () => void;
}

let tabCounter = 0;
const generateId = () => `tab-${Date.now()}-${++tabCounter}`;

export const useTerminalStore = create<TerminalStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      customTitles: {},

      setTabs: (sessions) => {
        const current = get().tabs;
        const customTitles = get().customTitles;
        const newTabs = sessions.map(s => {
          const existing = current.find(t => t.sessionId === s.name);
          if (existing) return existing;
          const customTitle = customTitles[s.name];
          return {
            id: generateId(),
            title: customTitle || (s.name === 'main' ? '终端' : s.name),
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
        const customTitle = get().customTitles[sessionName];
        const newTab: TerminalTabInfo = {
          id,
          title: customTitle || (sessionName === 'main' ? '终端' : sessionName),
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

      // 自定义标题：按 sessionId 持久化，多端拉取 session 列表后仍能恢复
      setCustomTitle: (sessionId, title) =>
        set(state => {
          const trimmed = title.trim();
          if (!trimmed) {
            const { [sessionId]: _, ...rest } = state.customTitles;
            return {
              customTitles: rest,
              tabs: state.tabs.map(t =>
                t.sessionId === sessionId
                  ? { ...t, title: sessionId === 'main' ? '终端' : sessionId }
                  : t
              ),
            };
          }
          return {
            customTitles: { ...state.customTitles, [sessionId]: trimmed },
            tabs: state.tabs.map(t =>
              t.sessionId === sessionId ? { ...t, title: trimmed } : t
            ),
          };
        }),

      clearCustomTitle: (sessionId) =>
        set(state => {
          const { [sessionId]: _, ...rest } = state.customTitles;
          return {
            customTitles: rest,
            tabs: state.tabs.map(t =>
              t.sessionId === sessionId
                ? { ...t, title: sessionId === 'main' ? '终端' : sessionId }
                : t
            ),
          };
        }),

      clearTabs: () => set({ tabs: [], activeTabId: null }),
    }),
    {
      name: 'flux_terminal_titles',
      partialize: (state) => ({ customTitles: state.customTitles }),
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
