import { useState, useEffect, useCallback, useMemo } from 'react';
import { nginxApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import Editor, { loader } from '@monaco-editor/react';
import type { AxiosError } from 'axios';
import {
  RotateCw, FileText, Save, Loader2,
  CheckCircle2, AlertTriangle, ScrollText, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';

loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });

interface NginxStatus {
  running: boolean;
  version: string;
  pid: number;
  workerProcesses: number;
}

interface ConfigItem {
  name: string;
  path: string;
  category: 'main' | 'conf.d' | 'sites-available' | 'snippets';
  size: number;
  mtime: string;
  enabled?: boolean;
}

const CATEGORY_LABEL: Record<ConfigItem['category'], string> = {
  main: '主配置',
  'conf.d': 'conf.d',
  'sites-available': '站点 (sites-available)',
  snippets: 'Snippets',
};

const CATEGORY_ORDER: ConfigItem['category'][] = ['main', 'conf.d', 'sites-available', 'snippets'];

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    : `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function NginxPage() {
  const [status, setStatus] = useState<NginxStatus>({ running: false, version: '', pid: 0, workerProcesses: 0 });
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState('');
  const [logType, setLogType] = useState<'access' | 'error'>('error');
  const [logLines, setLogLines] = useState(100);
  const addNotification = useAppStore((s) => s.addNotification);

  const dirty = content !== originalContent;

  const grouped = useMemo(() => {
    const map = new Map<ConfigItem['category'], ConfigItem[]>();
    for (const c of configs) {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    }
    return map;
  }, [configs]);

  const loadStatus = useCallback(async () => {
    try {
      const res = await nginxApi.getStatus();
      setStatus(res.data);
    } catch (_) {
      // 静默失败，不打扰
    }
  }, []);

  const loadConfigs = useCallback(async () => {
    try {
      const res = await nginxApi.listConfigs();
      setConfigs(res.data || []);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: string }>;
      addNotification({ type: 'error', message: `配置列表加载失败: ${axiosErr.response?.data?.error || '未知错误'}` });
    }
  }, [addNotification]);

  const loadFile = useCallback(async (file: string) => {
    setLoadingFile(true);
    try {
      const res = await nginxApi.getConfig(file);
      setContent(res.data.content || '');
      setOriginalContent(res.data.content || '');
      setCurrentFile(file);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: string }>;
      addNotification({ type: 'error', message: `读取失败: ${axiosErr.response?.data?.error || '未知错误'}` });
    } finally {
      setLoadingFile(false);
    }
  }, [addNotification]);

  const loadLogs = useCallback(async () => {
    try {
      const res = await nginxApi.getLogs(logType, logLines);
      setLogs(res.data.logs || '');
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: string }>;
      addNotification({ type: 'error', message: `日志加载失败: ${axiosErr.response?.data?.error || '未知错误'}` });
    }
  }, [addNotification, logType, logLines]);

  useEffect(() => {
    loadStatus();
    loadConfigs();
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, [loadStatus, loadConfigs]);

  useEffect(() => {
    if (showLogs) loadLogs();
  }, [showLogs, loadLogs]);

  const handleSelectFile = async (file: string) => {
    if (file === currentFile) return;
    if (dirty && !window.confirm('当前文件有未保存修改，确定切换？')) return;
    await loadFile(file);
  };

  const handleSave = async () => {
    if (!currentFile || !dirty) return;
    setSaving(true);
    try {
      await nginxApi.saveConfig(currentFile, content);
      setOriginalContent(content);
      addNotification({ type: 'success', message: '已保存' });
      loadConfigs();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: string }>;
      addNotification({ type: 'error', message: `保存失败: ${axiosErr.response?.data?.error || '未知错误'}` });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await nginxApi.testConfig();
      const ok = res.data?.ok;
      const output = res.data?.output || '';
      addNotification({
        type: ok ? 'success' : 'error',
        message: ok ? '配置检测通过' : '配置检测未通过',
      });
      if (output) {
        setShowLogs(true);
        setLogs((prev) => `[nginx -t]\n${output}\n\n${prev}`);
      }
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: string }>;
      addNotification({ type: 'error', message: `检测失败: ${axiosErr.response?.data?.error || '未知错误'}` });
    } finally {
      setTesting(false);
    }
  };

  const handleReload = async () => {
    if (!window.confirm('确认重载 Nginx？重载前会自动检测配置。')) return;
    setReloading(true);
    try {
      const res = await nginxApi.reload();
      const ok = res.data?.ok;
      const output = res.data?.testOutput || '';
      addNotification({
        type: ok ? 'success' : 'error',
        message: ok ? 'Nginx 已重载' : res.data?.error || '重载失败',
      });
      if (output) {
        setShowLogs(true);
        setLogs((prev) => `[reload]\n${output}\n\n${prev}`);
      }
      if (ok) loadStatus();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: string; testOutput?: string }>;
      const output = axiosErr.response?.data?.testOutput || '';
      addNotification({ type: 'error', message: `重载失败: ${axiosErr.response?.data?.error || axiosErr.message}` });
      if (output) {
        setShowLogs(true);
        setLogs((prev) => `[reload 失败]\n${output}\n\n${prev}`);
      }
    } finally {
      setReloading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 顶部状态条 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${status.running ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-sm font-medium text-white">{status.running ? '运行中' : '已停止'}</span>
          {status.version && <span className="text-xs text-zinc-500 truncate">{status.version}</span>}
          {status.pid > 0 && <span className="text-xs text-zinc-600 hidden md:inline">PID {status.pid}</span>}
          {status.workerProcesses > 0 && <span className="text-xs text-zinc-600 hidden md:inline">worker {status.workerProcesses}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 disabled:opacity-50 transition-colors"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            检测
          </button>
          <button
            onClick={handleReload}
            disabled={reloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-medium disabled:opacity-50 transition-colors"
          >
            {reloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
            重载
          </button>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showLogs
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            日志
            {showLogs ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* 主体 */}
      <div className="flex flex-1 min-h-0">
        {/* 左侧文件列表 */}
        <div className="w-60 border-r border-zinc-800 bg-zinc-900 flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs uppercase text-zinc-500 tracking-wider">配置文件</span>
            <button onClick={loadConfigs} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors" title="刷新">
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {CATEGORY_ORDER.map((cat) => {
              const items = grouped.get(cat);
              if (!items || items.length === 0) return null;
              return (
                <div key={cat} className="mb-2">
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">{CATEGORY_LABEL[cat]}</div>
                  {items.map((item) => {
                    const active = item.path === currentFile;
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleSelectFile(item.path)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors group ${
                          active ? 'bg-emerald-600/15 text-emerald-300 border-l-2 border-emerald-500' : 'text-zinc-300 hover:bg-zinc-800/60 border-l-2 border-transparent'
                        }`}
                      >
                        <FileText className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                        <span className="flex-1 min-w-0 truncate">{item.name}</span>
                        {item.enabled && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="已启用" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {configs.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-zinc-600">暂无配置文件</div>
            )}
          </div>
        </div>

        {/* 编辑器 */}
        <div className="flex-1 flex flex-col min-h-0 bg-zinc-950">
          {currentFile ? (
            <>
              <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span className="text-sm text-white truncate">{currentFile}</span>
                  {dirty && (
                    <span className="flex items-center gap-1 text-xs text-amber-400 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      未保存
                    </span>
                  )}
                  {currentFile && configs.find((c) => c.path === currentFile)?.mtime && (
                    <span className="text-xs text-zinc-600 shrink-0">
                      {formatTime(configs.find((c) => c.path === currentFile)!.mtime)}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  保存
                </button>
              </div>
              <div className="flex-1 min-h-0 relative">
                {loadingFile && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60 z-10">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  </div>
                )}
                <Editor
                  value={content}
                  onChange={(v) => setContent(v || '')}
                  theme="vs-dark"
                  defaultLanguage="ini"
                  language="ini"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    tabSize: 4,
                    automaticLayout: true,
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-3">
              <AlertTriangle className="w-10 h-10 text-zinc-700" />
              <p className="text-sm">从左侧选择配置文件开始编辑</p>
            </div>
          )}
        </div>
      </div>

      {/* 日志面板 */}
      {showLogs && (
        <div className="border-t border-zinc-800 bg-zinc-950 h-56 flex flex-col shrink-0">
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-zinc-800 bg-zinc-900">
            <ScrollText className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">日志</span>
            <div className="flex-1" />
            <select
              value={logType}
              onChange={(e) => setLogType(e.target.value as 'access' | 'error')}
              className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-zinc-300 outline-none"
            >
              <option value="error">Error</option>
              <option value="access">Access</option>
            </select>
            <select
              value={logLines}
              onChange={(e) => setLogLines(Number(e.target.value))}
              className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-zinc-300 outline-none"
            >
              <option value={50}>50行</option>
              <option value={100}>100行</option>
              <option value={500}>500行</option>
              <option value={1000}>1000行</option>
            </select>
            <button onClick={loadLogs} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors" title="刷新日志">
              <RotateCw className="w-3 h-3" />
            </button>
          </div>
          <pre className="flex-1 overflow-auto px-4 py-2 text-zinc-400 font-mono text-xs whitespace-pre-wrap break-all">
            {logs || '(空)'}
          </pre>
        </div>
      )}
    </div>
  );
}
