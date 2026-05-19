import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useTerminalStore, useTerminalSettings } from '@/stores/terminal';
import { useAppStore } from '@/stores/app';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  Plus, X, Maximize2, Minimize2, Search,
  Wifi, WifiOff, Trash2, Copy, XOctagon
} from 'lucide-react';
import type { TerminalTab } from '@/types';

const WS_URL = 'wss://www.haoaiganfan.top/terminal';

export default function TerminalPage() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab } = useTerminalStore();
  const isMobile = useAppStore((s) => s.isMobile);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (tabs.length === 0) {
      addTab();
    }
  }, [tabs.length, addTab]);

  return (
    <div className={`flex flex-col h-full bg-zinc-950 ${fullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-zinc-800 bg-zinc-900 overflow-x-auto">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onClick={() => setActiveTab(tab.id)}
            onClose={() => removeTab(tab.id)}
          />
        ))}
        <button
          onClick={() => addTab()}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Terminal container */}
      <div className="flex-1 overflow-hidden relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${tab.id === activeTabId ? 'block' : 'hidden'}`}
          >
            <TerminalInstance tab={tab} isMobile={isMobile} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TabButton({ tab, isActive, onClick, onClose }: {
  tab: TerminalTab; isActive: boolean; onClick: () => void; onClose: () => void;
}) {
  const statusColors: Record<string, string> = {
    CONNECTED: 'text-emerald-400',
    CONNECTING: 'text-amber-400',
    DISCONNECTED: 'text-zinc-500',
    RECONNECTING: 'text-sky-400',
    ERROR: 'text-red-400',
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer min-w-0 max-w-40
        transition-colors border
        ${isActive
          ? 'bg-zinc-800 border-zinc-700 text-white'
          : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
        }
      `}
    >
      <div className={`w-2 h-2 rounded-full ${statusColors[tab.status] || 'text-zinc-500'}`} />
      <span className="truncate">{tab.title}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="ml-1 p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function TerminalInstance({ tab, isMobile }: { tab: TerminalTab; isMobile: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const updateTab = useTerminalStore((s) => s.updateTab);
  const { fontSize, fontFamily, cursorBlink, scrollback } = useTerminalSettings();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [wsState, setWsState] = useState<string>('CLOSED');

  const { send, disconnect } = useWebSocket({
    url: `${WS_URL}?token=${localStorage.getItem('flux_auth') ? JSON.parse(localStorage.getItem('flux_auth') || '{}').token : ''}`,
    onOpen: () => {
      updateTab(tab.id, { status: 'CONNECTED' });
      setWsState('OPEN');
    },
    onMessage: (data) => {
      if (xtermRef.current) {
        xtermRef.current.write(data);
      }
    },
    onClose: () => {
      updateTab(tab.id, { status: 'DISCONNECTED' });
      setWsState('CLOSED');
    },
    onError: () => {
      updateTab(tab.id, { status: 'ERROR' });
      setWsState('ERROR');
    },
    reconnect: true,
    reconnectInterval: 2000,
    maxReconnects: 10,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      fontSize,
      fontFamily,
      cursorBlink,
      scrollback,
      theme: {
        background: '#09090b',
        foreground: '#e4e4e7',
        cursor: '#0d9373',
        selectionBackground: '#0d937340',
        black: '#18181b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e4e4e7',
        brightBlack: '#27272a',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#fafafa',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    term.onData((data) => {
      send(data);
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    const handleResize = () => {
      try { fitAddon.fit(); } catch { /* ignore */ }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      disconnect();
    };
  }, [tab.id]);

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.fontSize = fontSize;
      xtermRef.current.options.fontFamily = fontFamily;
      xtermRef.current.options.cursorBlink = cursorBlink;
      xtermRef.current.options.scrollback = scrollback;
      try { fitAddonRef.current?.fit(); } catch { /* ignore */ }
    }
  }, [fontSize, fontFamily, cursorBlink, scrollback]);

  const handleSearch = () => {
    if (searchAddonRef.current && searchQuery) {
      searchAddonRef.current.findNext(searchQuery);
    }
  };

  const handleCopy = () => {
    if (xtermRef.current) {
      const selection = xtermRef.current.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
      }
    }
  };

  const handleClear = () => {
    xtermRef.current?.clear();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Terminal actions */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <button onClick={() => setShowSearch(!showSearch)} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
          <Search className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleCopy} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleClear} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => disconnect()} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors">
          <XOctagon className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          {wsState === 'OPEN' ? (
            <Wifi className="w-3 h-3 text-emerald-400" />
          ) : (
            <WifiOff className="w-3 h-3 text-red-400" />
          )}
          <span className="font-mono">{wsState}</span>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/30">
          <Search className="w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索..."
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
            autoFocus
          />
          <button onClick={handleSearch} className="text-xs text-zinc-400 hover:text-white px-2 py-0.5 rounded hover:bg-zinc-800">
            Enter
          </button>
          <button onClick={() => setShowSearch(false)} className="text-zinc-500 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Terminal */}
      <div className="flex-1 overflow-hidden p-1">
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ touchAction: 'pan-x pan-y' }}
        />
      </div>

      {/* Mobile shortcut bar */}
      {isMobile && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-t border-zinc-800 bg-zinc-900 overflow-x-auto">
          {['ESC', 'TAB', 'CTRL', '↑', '↓', '←', '→', '|', '>', '&'].map((key) => (
            <button
              key={key}
              onClick={() => {
                const keyMap: Record<string, string> = {
                  'ESC': '\x1b',
                  'TAB': '\t',
                  'CTRL': '',
                  '↑': '\x1b[A',
                  '↓': '\x1b[B',
                  '←': '\x1b[D',
                  '→': '\x1b[C',
                };
                if (keyMap[key]) send(keyMap[key]);
              }}
              className="px-2.5 py-1 rounded bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors shrink-0 font-mono"
            >
              {key}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
