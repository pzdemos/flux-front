import { useState, useEffect, useCallback, useRef } from 'react';
import { systemApi } from '@/api/client';
import { Activity, Cpu, HardDrive, Gauge } from 'lucide-react';

interface ServerData {
  hostname: string;
  platform: string;
  uptime: number;
  nodeVersion: string;
  cpu: {
    model: string;
    cores: number;
    loadAverage: { '1min': string; '5min': string; '15min': string };
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: Array<{
    filesystem: string;
    total: number;
    used: number;
    avail: number;
    usagePercent: string;
    mount: string;
  }>;
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)}${units[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function usageColor(percent: number): string {
  if (percent < 60) return 'bg-emerald-400';
  if (percent < 85) return 'bg-amber-400';
  return 'bg-rose-400';
}

function usageTextColor(percent: number): string {
  if (percent < 60) return 'text-emerald-400';
  if (percent < 85) return 'text-amber-400';
  return 'text-rose-400';
}

function pulseClass(percent: number): string {
  if (percent > 85) return 'animate-pulse';
  return '';
}

export default function ServerStatus() {
  const [data, setData] = useState<ServerData | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await systemApi.getStatus();
      setData(res.data.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchStatus(); const id = setInterval(fetchStatus, 30000); return () => clearInterval(id); }, [fetchStatus]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!data) return null;

  const mem = data.memory;
  const cpuLoad = parseFloat(data.cpu.loadAverage['1min']);
  const disk = data.disk[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`group flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all duration-300
          ${open ? 'bg-zinc-800/80 ring-1 ring-zinc-700/50' : 'hover:bg-zinc-800/50'}
        `}
      >
        <div className="flex items-center gap-1.5">
          <span className={`relative flex h-1.5 w-1.5 ${pulseClass(mem.usagePercent)}`}>
            <span className={`absolute inline-flex h-full w-full rounded-full ${usageColor(mem.usagePercent)} opacity-75`} />
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${usageColor(mem.usagePercent)}`} />
          </span>
          <span className={`font-mono font-medium tabular-nums ${usageTextColor(mem.usagePercent)}`}>{mem.usagePercent}%</span>
        </div>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-500 font-mono tabular-nums">{cpuLoad.toFixed(1)}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 origin-top-right">
          <div className="relative bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/3 to-transparent pointer-events-none" />

            {/* Header */}
            <div className="relative px-4 pt-3 pb-2 border-b border-zinc-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-medium text-zinc-300">{data.hostname}</span>
                </div>
                <span className="text-[10px] text-zinc-600 font-mono">{data.platform}</span>
              </div>
              <div className="text-[10px] text-zinc-600 mt-0.5 font-mono">up {formatUptime(data.uptime)}</div>
            </div>

            {/* Memory */}
            <div className="relative px-4 py-2.5 border-b border-zinc-800/50">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-zinc-500" />
                  <span className="text-[11px] text-zinc-400">内存</span>
                </div>
                <span className={`text-[11px] font-mono font-medium tabular-nums ${usageTextColor(mem.usagePercent)}`}>{mem.usagePercent}%</span>
              </div>
              <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${usageColor(mem.usagePercent)}`} style={{ width: `${mem.usagePercent}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-zinc-600 font-mono">
                <span>{formatBytes(mem.used)} / {formatBytes(mem.total)}</span>
                <span>{formatBytes(mem.free)} 空闲</span>
              </div>
            </div>

            {/* CPU */}
            <div className="relative px-4 py-2.5 border-b border-zinc-800/50">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3 h-3 text-zinc-500" />
                  <span className="text-[11px] text-zinc-400">CPU</span>
                </div>
                <span className="text-[11px] text-zinc-500 font-mono tabular-nums">{data.cpu.cores}核 · 负载 {cpuLoad.toFixed(2)}</span>
              </div>
              <div className="flex gap-1">
                {[1, 5, 15].map((m) => {
                  const load = parseFloat(data.cpu.loadAverage[`${m}min` as keyof typeof data.cpu.loadAverage]);
                  const pct = Math.min(load / data.cpu.cores * 100, 100);
                  return (
                    <div key={m} className="flex-1">
                      <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                        <div className={`h-full rounded-full ${usageColor(pct)}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[9px] text-zinc-600 text-center mt-0.5 font-mono">{m}min</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Disk */}
            {disk && (
              <div className="relative px-4 py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="w-3 h-3 text-zinc-500" />
                    <span className="text-[11px] text-zinc-400">磁盘</span>
                  </div>
                  <span className={`text-[11px] font-mono font-medium tabular-nums ${usageTextColor(parseFloat(disk.usagePercent))}`}>{disk.usagePercent}%</span>
                </div>
                <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${usageColor(parseFloat(disk.usagePercent))}`} style={{ width: `${disk.usagePercent}%` }} />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-zinc-600 font-mono">
                  <span>{formatBytes(disk.used)} / {formatBytes(disk.total)}</span>
                  <span>{disk.mount}</span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="relative px-4 py-1.5 border-t border-zinc-800/50">
              <div className="text-[9px] text-zinc-700 font-mono text-right">
                Node {data.nodeVersion} · auto-refresh 30s
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
