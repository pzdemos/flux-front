import { useState, useEffect, useCallback } from 'react';
import { processApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import type { ManagedProcess, ProcessDefinition } from '@/types';
import {
  Activity, Play, Square, RotateCcw, X,
  Loader2, Trash2, Save, FileText
} from 'lucide-react';

export default function ProcessPage() {
  const [processes, setProcesses] = useState<ManagedProcess[]>([]);
  const [definitions, setDefinitions] = useState<ProcessDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newCwd, setNewCwd] = useState('');
  const [logs, setLogs] = useState<{ name: string; stdout: string; stderr: string } | null>(null);
  const addNotification = useAppStore((s) => s.addNotification);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, dRes] = await Promise.all([
        processApi.list(),
        processApi.listDefinitions().catch(() => ({ data: { definitions: [] } })),
      ]);
      setProcesses(pRes.data.processes || []);
      setDefinitions(dRes.data.definitions || []);
    } catch {
      addNotification({ type: 'error', message: '加载进程列表失败' });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { load(); }, [load]);

  const handleStart = async () => {
    if (!newName || !newCommand) return;
    try {
      await processApi.start(newName, newCommand, newCwd || undefined);
      addNotification({ type: 'success', message: `进程 "${newName}" 已启动` });
      setShowStart(false);
      setNewName('');
      setNewCommand('');
      setNewCwd('');
      load();
    } catch {
      addNotification({ type: 'error', message: '启动失败' });
    }
  };

  const handleStop = async (name: string) => {
    try {
      await processApi.stop(name);
      addNotification({ type: 'success', message: `进程 "${name}" 已停止` });
      load();
    } catch {
      addNotification({ type: 'error', message: '停止失败' });
    }
  };

  const handleRestart = async (name: string) => {
    try {
      await processApi.restart(name);
      addNotification({ type: 'success', message: `进程 "${name}" 已重启` });
      load();
    } catch {
      addNotification({ type: 'error', message: '重启失败' });
    }
  };

  const handleShowLogs = async (name: string) => {
    try {
      const res = await processApi.getLogs(name, 100);
      setLogs({ name, ...res.data });
    } catch {
      addNotification({ type: 'error', message: '获取日志失败' });
    }
  };

  const handleSaveDefinition = async (name: string, command: string, cwd?: string) => {
    try {
      await processApi.saveDefinition(name, command, cwd);
      addNotification({ type: 'success', message: '定义已保存' });
      load();
    } catch {
      addNotification({ type: 'error', message: '保存失败' });
    }
  };

  const handleDeleteDefinition = async (id: number) => {
    try {
      await processApi.deleteDefinition(id);
      addNotification({ type: 'success', message: '定义已删除' });
      load();
    } catch {
      addNotification({ type: 'error', message: '删除失败' });
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      running: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      stopped: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
      exited: 'bg-red-500/20 text-red-400 border-red-500/30',
      error: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[status] || 'bg-zinc-500/20 text-zinc-400'}`}>
        {status === 'running' ? '运行中' : status === 'stopped' ? '已停止' : status === 'exited' ? '已退出' : status}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Node 进程管理</h2>
        <button
          onClick={() => setShowStart(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition-colors"
        >
          <Play className="w-4 h-4" /> 启动进程
        </button>
      </div>

      {/* Start dialog */}
      {showStart && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">启动新进程</h3>
            <button onClick={() => setShowStart(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="进程名称" className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500" />
            <input value={newCommand} onChange={(e) => setNewCommand(e.target.value)} placeholder="启动命令 (如 node app.js)" className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500" />
            <input value={newCwd} onChange={(e) => setNewCwd(e.target.value)} placeholder="工作目录 (可选)" className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500" />
            <div className="flex gap-2">
              <button onClick={handleStart} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm">启动</button>
              <button onClick={() => setShowStart(false)} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Logs panel */}
      {logs && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-white font-mono">{logs.name} 日志</h3>
            <button onClick={() => setLogs(null)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          {logs.stderr && (
            <pre className="text-xs text-red-400 font-mono bg-zinc-950 rounded p-3 mb-2 overflow-x-auto whitespace-pre-wrap max-h-40">{logs.stderr}</pre>
          )}
          <pre className="text-xs text-zinc-300 font-mono bg-zinc-950 rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-60">{logs.stdout || '(无输出)'}</pre>
        </div>
      )}

      {/* Process list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : processes.length === 0 && definitions.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <Activity className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>暂无运行中的进程</p>
          <p className="text-xs mt-1">点击"启动进程"开始</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Running processes */}
          {processes.filter(p => p.status === 'running').map((p) => (
            <div key={p.name} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded bg-emerald-500/10 shrink-0">
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{p.name}</span>
                    {statusBadge(p.status)}
                    <span className="text-xs text-zinc-500 font-mono">PID {p.pid}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 font-mono">{p.command}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">{p.cwd}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => handleShowLogs(p.name)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400 transition-colors" title="日志">
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleRestart(p.name)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-blue-400 transition-colors" title="重启">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleStop(p.name)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors" title="停止">
                    <Square className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Exited processes */}
          {processes.filter(p => p.status !== 'running').length > 0 && (
            <>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider pt-2">已退出/已停止</h3>
              {processes.filter(p => p.status !== 'running').map((p) => (
                <div key={p.name} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 opacity-70">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded bg-zinc-800 shrink-0">
                      <Activity className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-zinc-400">{p.name}</span>
                        {statusBadge(p.status)}
                        {p.exitCode !== null && <span className="text-xs text-zinc-600">exit {p.exitCode}</span>}
                      </div>
                      <p className="text-xs text-zinc-600 font-mono">{p.command}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleShowLogs(p.name)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-600 hover:text-emerald-400 transition-colors" title="日志">
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Saved definitions */}
          {definitions.length > 0 && (
            <>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider pt-4">已保存的定义</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {definitions.map((d) => (
                  <div key={d.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded bg-zinc-800 shrink-0">
                        <Save className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{d.name}</p>
                        <p className="text-xs text-zinc-500 font-mono mt-0.5">{d.command}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setNewName(d.name);
                            setNewCommand(d.command);
                            setNewCwd(d.cwd || '');
                            setShowStart(true);
                          }}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400 transition-colors"
                          title="启动"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDefinition(d.id)}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Quick actions from definitions */}
      {processes.length > 0 && definitions.length === 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <button
            onClick={() => {
              const p = processes[0];
              handleSaveDefinition(p.name, p.command, p.cwd);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            <Save className="w-4 h-4" /> 保存当前进程定义为快捷启动
          </button>
        </div>
      )}
    </div>
  );
}
