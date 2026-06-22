import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useTerminalStore, useTerminalSettings } from '@/stores/terminal';
import { useAppStore } from '@/stores/app';
import {
  Plus, X, Maximize2, Minimize2, Search,
  Wifi, WifiOff, Trash2, Copy,
  Terminal as TerminalIcon
} from 'lucide-react';
import { apiClient } from '@/api/client';

const WS_BASE = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/flux/ws/tmux`;
const getToken = () => localStorage.getItem('flux_token') || '';
const API_POLL_MS = 30000; // 兜底轮询：实时同步靠 WS 广播，这里拉长到 30s 降噪

export default function TerminalPage({ visible }: { visible?: boolean }) {
  const { tabs, activeTabId, setTabs, setActiveTab } = useTerminalStore();
  const isMobile = useAppStore((s) => s.isMobile);
  const [fullscreen, setFullscreen] = useState(false);
  const bootRef = useRef(false);

  // 从后端加载会话列表
  const loadSessions = useCallback(async () => {
    try {
      const res = await apiClient.get('/tmux/sessions');
      const sessions = res.data?.sessions || [];
      const state = useTerminalStore.getState();
      if (JSON.stringify(sessions.map((s: { name: string }) => s.name).sort()) !==
          JSON.stringify(state.tabs.map(t => t.sessionId).sort())) {
        setTabs(sessions);
      }
    } catch { /* ignore */ }
  }, [setTabs]);

  // 挂载时加载，并轮询同步跨窗口变更
  useEffect(() => {
    loadSessions();
    const timer = setInterval(loadSessions, API_POLL_MS);
    return () => clearInterval(timer);
  }, [loadSessions]);

  // 多端实时同步：WS 广播触发后 debounce 重新拉取（500ms 内多次只执行一次）
  const sessionChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSessionChange = useCallback(() => {
    if (sessionChangeTimerRef.current) clearTimeout(sessionChangeTimerRef.current);
    sessionChangeTimerRef.current = setTimeout(() => {
      loadSessions();
    }, 500);
  }, [loadSessions]);

  // tabs 为空时自动创建 main 会话（仅首次）
  useEffect(() => {
    if (tabs.length === 0 && !bootRef.current) {
      bootRef.current = true;
      apiClient.post('/tmux/sessions', { name: 'main', workdir: '/' }).then(() => {
        loadSessions();
      }).catch(() => loadSessions());
    }
  }, [tabs.length, loadSessions]);

  const handleAddTab = useCallback(() => {
    const name = `term-${Date.now()}`;
    apiClient.post('/tmux/sessions', { name, workdir: '/' }).then(() => {
      // 创建成功后立刻拉取列表并主动切到新会话
      apiClient.get('/tmux/sessions').then((res) => {
        const sessions = res.data?.sessions || [];
        setTabs(sessions);
        // 找到刚创建的 session 并激活
        const newTab = useTerminalStore.getState().tabs.find(t => t.sessionId === name);
        if (newTab) useTerminalStore.getState().setActiveTab(newTab.id);
      }).catch(() => loadSessions());
    }).catch(() => loadSessions());
  }, [loadSessions, setTabs]);

  const handleRemoveTab = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      apiClient.delete(`/tmux/sessions/${tab.sessionId}`).then(() => loadSessions());
    }
  }, [tabs, loadSessions]);

  return (
    <div className={`flex flex-col h-full bg-zinc-950 ${fullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-zinc-800 bg-zinc-900 overflow-x-auto">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onClick={() => setActiveTab(tab.id)}
            onClose={() => handleRemoveTab(tab.id)}
          />
        ))}
        <button
          onClick={handleAddTab}
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

      <div className="flex-1 overflow-hidden relative">
        {tabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
            <TerminalIcon className="w-12 h-12 text-zinc-700" />
            <p className="text-sm">暂无终端会话</p>
            <button
              onClick={handleAddTab}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-sm"
            >
              <Plus className="w-4 h-4 inline mr-1" />新建终端
            </button>
          </div>
        ) : (
          tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 ${tab.id === activeTabId ? 'block' : 'hidden'}`}
            >
              <TerminalInstance tab={tab} isMobile={isMobile} isActive={tab.id === activeTabId} visible={!!visible} onSessionChange={handleSessionChange} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TabButton({ tab, isActive, onClick, onClose }: {
  tab: { id: string; title: string; status: string }; isActive: boolean; onClick: () => void; onClose: () => void;
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
      className={`group flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer min-w-0 max-w-40
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

function TerminalInstance({ tab, isMobile, isActive, visible, onSessionChange }: { tab: { id: string; sessionId: string }; isMobile: boolean; isActive: boolean; visible?: boolean; onSessionChange?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const updateTabStatus = useTerminalStore((s) => s.updateTabStatus);
  const { fontSize, fontFamily, cursorBlink, scrollback } = useTerminalSettings();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const inputBufferRef = useRef<string[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;
    let manualClose = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attemptCount = 0;

    const MAX_RECONNECT = 5;
    const BACKOFF_BASE_MS = 1000;

    const flushPending = () => {
      while (inputBufferRef.current.length > 0) {
        const data = inputBufferRef.current[0];
        if (ws?.readyState === WebSocket.OPEN) {
          try { ws.send(data); } catch (_) { break; }
          inputBufferRef.current.shift();
        } else {
          break;
        }
      }
    };

    const connect = () => {
      if (cancelled) return;
      const token = getToken();
      if (!token) return;

      const url = `${WS_BASE}?token=${token}&session=${tab.sessionId}`;
      updateTabStatus(tab.id, attemptCount === 0 ? 'CONNECTING' : 'RECONNECTING');
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) { try { ws?.close(); } catch (_) {} return; }
        setWsConnected(true);
        updateTabStatus(tab.id, 'CONNECTED');
        attemptCount = 0;
        const dims = fitAddonRef.current?.proposeDimensions();
        if (dims) {
          ws?.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
        }
        flushPending();
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          switch (msg.type) {
            case 'output':
              xtermRef.current?.write(msg.data);
              break;
            case 'connected':
              setWsConnected(true);
              updateTabStatus(tab.id, 'CONNECTED');
              break;
            case 'notice':
              xtermRef.current?.write(msg.data);
              break;
            case 'exit':
              xtermRef.current?.write(`\r\n\x1b[31m[进程退出] exitCode=${msg.exitCode}${msg.signal ? ` signal=${msg.signal}` : ''}\x1b[0m\r\n`);
              setWsConnected(false);
              updateTabStatus(tab.id, 'DISCONNECTED');
              break;
            case 'error':
              xtermRef.current?.write(`\r\n\x1b[31m[错误] ${msg.message}\x1b[0m\r\n`);
              setWsConnected(false);
              updateTabStatus(tab.id, 'ERROR');
              break;
            // 多端实时同步：后端广播的会话级消息
            case 'session_created':
            case 'session_deleted':
            case 'sessions':
              onSessionChange?.();
              break;
          }
        } catch {
          xtermRef.current?.write(e.data);
        }
      };

      ws.onclose = (event) => {
        if (cancelled) return;
        setWsConnected(false);

        // 服务端主动断开（1000 正常退出 / 1001 会话销毁 / 4000 attach 失败）→ 不重连
        const intentional = event.code === 1000 || event.code === 1001 || event.code === 4000;
        if (intentional || manualClose) {
          updateTabStatus(tab.id, 'DISCONNECTED');
          return;
        }

        // 网络问题 / 反代超时 → 指数退避重连
        if (attemptCount < MAX_RECONNECT) {
          attemptCount++;
          const delay = BACKOFF_BASE_MS * Math.pow(2, attemptCount - 1);
          updateTabStatus(tab.id, 'RECONNECTING');
          reconnectTimer = setTimeout(connect, delay);
        } else {
          updateTabStatus(tab.id, 'DISCONNECTED');
        }
      };

      ws.onerror = () => {
        if (cancelled) return;
        updateTabStatus(tab.id, 'ERROR');
      };
    };

    connect();

    return () => {
      cancelled = true;
      manualClose = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws?.close(); } catch (_) {}
    };
  }, [tab.id, tab.sessionId, updateTabStatus]);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(data); } catch (_) {}
    } else {
      // WS 未就绪（重连中），缓冲到重连后重放
      inputBufferRef.current.push(data);
    }
  }, []);

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

    const textarea = containerRef.current?.querySelector('textarea');
    if (textarea) {
      textarea.setAttribute('inputmode', 'text');
      textarea.setAttribute('autocomplete', 'off');
      textarea.setAttribute('autocorrect', 'off');
      textarea.setAttribute('autocapitalize', 'off');
      textarea.setAttribute('spellcheck', 'false');
    }

    const sendResize = () => {
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
      }
    };

    sendResize();

    term.onData((data) => {
      send(JSON.stringify({ type: 'input', data }));
    });

    term.onResize(({ cols, rows }) => {
      send(JSON.stringify({ type: 'resize', cols, rows }));
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    const doFit = () => {
      try {
        fitAddon.fit();
        sendResize();
      } catch { /* ignore */ }
    };
    window.addEventListener('resize', doFit);

    const observer = new ResizeObserver(doFit);
    observer.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', doFit);
      observer.disconnect();
      term.dispose();
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

  useEffect(() => {
    if (isActive) {
      const raf = requestAnimationFrame(() => {
        try { fitAddonRef.current?.fit(); } catch { /* ignore */ }
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [isActive]);

  useEffect(() => {
    if (visible && isActive) {
      const raf = requestAnimationFrame(() => {
        try {
          fitAddonRef.current?.fit();
          const dims = fitAddonRef.current?.proposeDimensions();
          if (dims) {
            send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
          }
        } catch { /* ignore */ }
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [visible, isActive, send]);

  const handleSearch = () => {
    if (searchAddonRef.current && searchQuery) {
      searchAddonRef.current.findNext(searchQuery);
    }
  };

  const handleCopy = () => {
    if (!xtermRef.current) return;
    let text = xtermRef.current.getSelection();
    if (!text) {
      const buffer = xtermRef.current.buffer.active;
      const lines: string[] = [];
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) lines.push(line.translateToString());
      }
      text = lines.join('\n');
    }
    if (text) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  };

  const handleClear = () => {
    xtermRef.current?.clear();
  };

  return (
    <div className="flex flex-col h-full">
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
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          {wsConnected ? (
            <>
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span className="font-mono">OPEN</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-red-400" />
              <span className="font-mono">CLOSED</span>
            </>
          )}
        </div>
      </div>

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

      <div
        className="flex-1 overflow-hidden"
        onWheel={(e) => {
          // 阻止 wheel 事件冒泡到外层，防止终端滚到顶/底时整页被滚动
          e.stopPropagation();
        }}
      >
        <div
          ref={containerRef}
          className="w-full h-full terminal-host"
          style={{
            touchAction: 'pan-x pan-y',
          }}
        />
      </div>

      {isMobile && (
        <div className="flex flex-col gap-1 px-2 py-2 border-t border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-1 overflow-x-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '_', '/', '.', '~'].map((key) => (
              <button
                key={key}
                onTouchStart={(e) => { e.preventDefault(); send(JSON.stringify({ type: 'input', data: key })); }}
                onClick={() => send(JSON.stringify({ type: 'input', data: key }))}
                className="w-8 h-9 rounded bg-zinc-800 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors shrink-0 font-mono flex items-center justify-center"
              >
                {key}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {['ESC', 'TAB', '↑', '↓', '←', '→', '|', '>', '&', '$', '#', '@', '!', '?', '*'].map((key) => (
              <button
                key={key}
                onTouchStart={(e) => { e.preventDefault(); const km: Record<string, string> = { 'ESC': '\x1b', 'TAB': '\t', '↑': '\x1b[A', '↓': '\x1b[B', '←': '\x1b[D', '→': '\x1b[C' }; if (km[key]) send(JSON.stringify({ type: 'input', data: km[key] })); }}
                onClick={() => {
                  const km: Record<string, string> = { 'ESC': '\x1b', 'TAB': '\t', '↑': '\x1b[A', '↓': '\x1b[B', '←': '\x1b[D', '→': '\x1b[C' };
                  if (km[key]) send(JSON.stringify({ type: 'input', data: km[key] })); else send(JSON.stringify({ type: 'input', data: key }));
                }}
                className="px-2.5 h-9 rounded bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors shrink-0 font-mono"
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
