import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  terminals: [] as any[], fits: [] as any[], observers: [] as any[],
  sessions: [{ name: 'alpha' }] as { name: string }[],
}));
vi.mock('@/api/client', () => ({ apiClient: mocks.api, WS_BASE_URL: '/flux/ws' }));
vi.mock('@/components/file-manager/TerminalSettingsDialog', () => ({ default: () => null }));
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    options: Record<string, unknown>;
    dataHandler = (_data: string) => {};
    resizeHandler = (_dimensions: { cols: number; rows: number }) => {};
    write = vi.fn(); dispose = vi.fn(); clear = vi.fn(); focus = vi.fn();
    buffer = { active: { length: 0 } };
    constructor(options: Record<string, unknown>) { this.options = options; mocks.terminals.push(this); }
    loadAddon() {}
    open(element: HTMLElement) { element.appendChild(document.createElement('textarea')); }
    onData(callback: typeof this.dataHandler) { this.dataHandler = callback; return { dispose() {} }; }
    onResize(callback: typeof this.resizeHandler) { this.resizeHandler = callback; return { dispose() {} }; }
    getSelection() { return ''; }
  },
}));
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class {
  dimensions = { cols: 80, rows: 24 };
  fit = vi.fn();
  constructor() { mocks.fits.push(this); }
  proposeDimensions() { return this.dimensions; }
} }));
vi.mock('@xterm/addon-search', () => ({ SearchAddon: class { findNext = vi.fn(); } }));
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: class {} }));

import TerminalPage from '@/pages/Terminal';
import { useTerminalStore } from '@/stores/terminal';
import { useAppStore } from '@/stores/app';

class MockWebSocket {
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
  static instances: MockWebSocket[] = [];
  readyState = MockWebSocket.CONNECTING;
  onopen: ((event?: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;
  frames: any[] = [];
  close = vi.fn((code = 1000) => this.serverClose(code));
  constructor(public url: string) { MockWebSocket.instances.push(this); }
  send(value: string) {
    if (this.readyState !== MockWebSocket.OPEN) throw new Error('socket not open');
    this.frames.push(JSON.parse(value));
  }
  open() { this.readyState = MockWebSocket.OPEN; this.onopen?.({}); }
  message(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
  serverClose(code = 1006) { this.readyState = MockWebSocket.CLOSED; this.onclose?.({ code }); }
}

const latestSocket = () => MockWebSocket.instances.at(-1)!;
const currentStatus = () => useTerminalStore.getState().tabs[0]?.status;
const advance = async (milliseconds: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); }); };
const event = (callback: () => void) => act(callback);
const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

function resetFixture() {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('flux_token', 'TEST_TOKEN_NOT_A_REAL_CREDENTIAL');
  MockWebSocket.instances = [];
  mocks.terminals.length = 0; mocks.fits.length = 0; mocks.observers.length = 0;
  mocks.sessions = [{ name: 'alpha' }];
  useTerminalStore.setState({ tabs: [], activeTabId: null, customTitles: {} });
  useAppStore.setState({ isMobile: false, notifications: [] });
  mocks.api.get.mockImplementation(async (url: string) => ({ data: {
    sessions: url === '/tmux/status' ? mocks.sessions.map(s => ({ ...s, wsConnections: 0 })) : mocks.sessions,
  } }));
  mocks.api.post.mockResolvedValue({ data: {} });
  mocks.api.delete.mockResolvedValue({ data: {} });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('ResizeObserver', class {
    disconnect = vi.fn(); observe = vi.fn();
    constructor(public callback: () => void) { mocks.observers.push(this); }
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
  vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
  resetFixture();
});
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('terminal first-frame authentication and lifecycle', () => {
  it('sends auth alone on open, then current resize and ordered input exactly once after connected', async () => {
    const sessionName = 'alpha & token=ignored?';
    mocks.sessions = [{ name: sessionName }];
    render(<TerminalPage visible />); await settle();
    const socket = latestSocket();
    expect(new URL(socket.url).searchParams.has('token')).toBe(false);
    expect(new URL(socket.url).searchParams.get('session')).toBe(sessionName);
    expect(socket.url).not.toContain('TEST_TOKEN');
    event(() => {
      mocks.terminals[0].dataHandler('one');
      mocks.terminals[0].resizeHandler({ cols: 10, rows: 6 });
      socket.open();
      mocks.terminals[0].dataHandler('two\r');
      socket.message({ type: 'authenticated' });
    });
    expect(currentStatus()).toBe('CONNECTING');
    expect(socket.frames).toEqual([{ type: 'auth', token: 'TEST_TOKEN_NOT_A_REAL_CREDENTIAL' }]);
    mocks.fits[0].dimensions = { cols: 120, rows: 35 };
    event(() => socket.message({ type: 'connected', sessionName }));
    expect(currentStatus()).toBe('CONNECTED');
    expect(socket.frames.slice(1)).toEqual([
      { type: 'resize', cols: 120, rows: 35 },
      { type: 'input', data: 'one' }, { type: 'input', data: 'two\r' },
    ]);
    event(() => socket.message({ type: 'connected', sessionName }));
    expect(socket.frames).toHaveLength(4);
    event(() => mocks.terminals[0].dataHandler('live\r'));
    expect(socket.frames.at(-1)).toEqual({ type: 'input', data: 'live\r' });
  });

  it('preserves early PTY output, notices, counts and debounced session broadcasts', async () => {
    render(<TerminalPage />); await settle();
    const socket = latestSocket();
    event(() => {
      socket.open();
      socket.message({ type: 'output', data: 'initial shell prompt' });
      socket.message({ type: 'notice', data: 'notice' });
      socket.message({ type: 'ws_counts', counts: { alpha: 2 } });
      socket.message({ type: 'toast', message: 'another terminal joined', level: 'info' });
    });
    expect(mocks.terminals[0].write).toHaveBeenCalledWith('initial shell prompt');
    expect(mocks.terminals[0].write).toHaveBeenCalledWith('notice');
    expect(useTerminalStore.getState().tabs[0].wsCount).toBe(2);
    expect(useAppStore.getState().notifications.some(n => n.message === 'another terminal joined')).toBe(true);
    const previousCalls = mocks.api.get.mock.calls.length;
    event(() => { socket.message({ type: 'sessions' }); socket.message({ type: 'session_created' }); });
    await advance(499); expect(mocks.api.get.mock.calls).toHaveLength(previousCalls);
    await advance(1); expect(mocks.api.get.mock.calls).toHaveLength(previousCalls + 1);
  });

  it('stops and discards pending input for every authentication error code', async () => {
    for (const code of ['AUTH_FAILED', 'AUTH_REQUIRED', 'AUTH_EXPIRED']) {
      render(<TerminalPage />); await settle();
      const socket = latestSocket();
      event(() => {
        socket.open(); mocks.terminals[0].dataHandler('must not replay\r');
        socket.message({ type: 'error', code });
        socket.message({ type: 'connected' });
        mocks.terminals[0].dataHandler('must not send\r');
      });
      expect(screen.getByRole('alert').textContent).toContain('重新登录');
      expect(socket.frames.map(frame => frame.type)).toEqual(['auth']);
      expect(currentStatus()).toBe('ERROR');
      await advance(60000);
      expect(MockWebSocket.instances).toHaveLength(1);
      cleanup(); vi.clearAllTimers(); resetFixture();
    }
  });

  it('does not reconnect after auth/permission close or the visible legacy-upgrade error', async () => {
    for (const code of [4001, 4003, 4000]) {
      render(<TerminalPage />); await settle();
      const socket = latestSocket();
      event(() => {
        socket.open();
        if (code === 4000) socket.message({ type: 'error', message: '客户端已更新，请刷新页面后重试。' });
        socket.serverClose(code);
        mocks.terminals[0].dataHandler('discard\r');
      });
      expect(screen.getByRole('alert').textContent).toContain(code === 4000 ? '刷新' : code === 4001 ? '登录' : '权限');
      await advance(60000);
      expect(MockWebSocket.instances).toHaveLength(1);
      expect(socket.frames.map(frame => frame.type)).toEqual(['auth']);
      cleanup(); vi.clearAllTimers(); resetFixture();
    }
  });

  it('limits network retries to five with 1/2/4/8/16-second backoff even when transport opens', async () => {
    render(<TerminalPage />); await settle();
    for (const [index, delay] of [1000, 2000, 4000, 8000, 16000].entries()) {
      event(() => { latestSocket().open(); latestSocket().serverClose(1006); });
      expect(currentStatus()).toBe('RECONNECTING');
      await advance(delay - 1); expect(MockWebSocket.instances).toHaveLength(index + 1);
      await advance(1); expect(MockWebSocket.instances).toHaveLength(index + 2);
    }
    event(() => { latestSocket().open(); latestSocket().serverClose(1006); });
    await advance(60000);
    expect(MockWebSocket.instances).toHaveLength(6);
    expect(currentStatus()).toBe('DISCONNECTED');
    expect(screen.getByRole('alert').textContent).toContain('连接失败');
  });

  it('times out a transport that never reaches connected and schedules a bounded retry', async () => {
    render(<TerminalPage />); await settle();
    const socket = latestSocket();
    event(() => socket.open());
    await advance(9999); expect(socket.close).not.toHaveBeenCalled();
    await advance(1); expect(socket.close).toHaveBeenCalledWith(4008, 'Connection timeout');
    expect(currentStatus()).toBe('RECONNECTING');
    await advance(1000); expect(MockWebSocket.instances).toHaveLength(2);
    event(() => { latestSocket().open(); latestSocket().message({ type: 'authenticated' }); });
    await advance(10000); expect(MockWebSocket.instances[1].close).toHaveBeenCalled();
    await advance(1999); expect(MockWebSocket.instances).toHaveLength(2);
    await advance(1); expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('resets retry backoff only after the terminal connected acknowledgement', async () => {
    render(<TerminalPage />); await settle();
    event(() => latestSocket().serverClose(1006)); await advance(1000);
    event(() => latestSocket().serverClose(1006)); await advance(2000);
    event(() => { latestSocket().open(); latestSocket().message({ type: 'connected' }); });
    await advance(10000); expect(currentStatus()).toBe('CONNECTED');
    event(() => latestSocket().serverClose(1006));
    await advance(999); expect(MockWebSocket.instances).toHaveLength(3);
    await advance(1); expect(MockWebSocket.instances).toHaveLength(4);
  });

  it('ignores obsolete sockets and clears queued commands when the login token changes', async () => {
    render(<TerminalPage />); await settle();
    const old = latestSocket();
    event(() => { old.open(); old.serverClose(1006); mocks.terminals[0].dataHandler('old login command\r'); });
    localStorage.setItem('flux_token', 'SECOND_TEST_CREDENTIAL');
    await advance(1000);
    const next = latestSocket();
    event(() => {
      next.open(); old.message({ type: 'connected' });
      old.message({ type: 'output', data: 'obsolete output' });
      old.message({ type: 'ws_counts', counts: { alpha: 99 } });
      old.serverClose(4001);
    });
    expect(next.frames).toEqual([{ type: 'auth', token: 'SECOND_TEST_CREDENTIAL' }]);
    expect(mocks.terminals[0].write).not.toHaveBeenCalledWith('obsolete output');
    expect(useTerminalStore.getState().tabs[0].wsCount).not.toBe(99);
    event(() => next.message({ type: 'connected' }));
    expect(next.frames.some(frame => frame.type === 'input')).toBe(false);
    expect(currentStatus()).toBe('CONNECTED');
  });

  it('keeps tabs and mobile input working when active/visible state changes during authentication', async () => {
    mocks.sessions = [{ name: 'alpha' }, { name: 'beta' }];
    useAppStore.setState({ isMobile: true });
    const view = render(<TerminalPage visible={false} />); await settle();
    expect(MockWebSocket.instances).toHaveLength(2);
    event(() => MockWebSocket.instances.forEach(socket => socket.open()));
    event(() => useTerminalStore.getState().setActiveTab(useTerminalStore.getState().tabs[1].id));
    mocks.fits[1].dimensions = { cols: 100, rows: 18 };
    view.rerender(<TerminalPage visible />); await advance(16);
    const textareas = view.container.querySelectorAll('textarea');
    event(() => textareas[1].dispatchEvent(new InputEvent('beforeinput', { data: 'mobile text', inputType: 'insertText', cancelable: true })));
    expect(MockWebSocket.instances[1].frames.map(frame => frame.type)).toEqual(['auth']);
    event(() => MockWebSocket.instances[1].message({ type: 'connected', sessionName: 'beta' }));
    expect(MockWebSocket.instances[1].frames.slice(1)).toEqual([
      { type: 'resize', cols: 100, rows: 18 }, { type: 'input', data: 'mobile text' },
    ]);
    expect(new URL(MockWebSocket.instances[1].url).searchParams.get('session')).toBe('beta');
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('cleans sockets, connection/reconnect timers and terminal observers when unmounted', async () => {
    const view = render(<TerminalPage visible />); await settle();
    const socket = latestSocket();
    event(() => { socket.open(); socket.message({ type: 'connected' }); });
    view.unmount();
    expect(socket.close).toHaveBeenCalled();
    expect(mocks.terminals[0].dispose).toHaveBeenCalled();
    expect(mocks.observers[0].disconnect).toHaveBeenCalled();
    const writes = mocks.terminals[0].write.mock.calls.length;
    event(() => { socket.message({ type: 'output', data: 'late' }); socket.serverClose(1006); });
    await advance(60000);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(mocks.terminals[0].write.mock.calls).toHaveLength(writes);
    expect(vi.getTimerCount()).toBe(0);
  });
});
