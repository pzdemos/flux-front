import { useState, useCallback } from 'react';
import { systemApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { HardDrive, Hash, Loader2 } from 'lucide-react';
import type { DiskUsageResponse, DiskSystemResponse } from '@/types';

export default function ToolsView() {
  const [activeTab, setActiveTab] = useState<'disk' | 'checksum' | 'duplicates'>('disk');
  const [diskUsage, setDiskUsage] = useState<DiskUsageResponse | null>(null);
  const [diskSystem, setDiskSystem] = useState<DiskSystemResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [checksumPath, setChecksumPath] = useState('');
  const [checksumResult, setChecksumResult] = useState<string | null>(null);
  const [checksumAlgo, setChecksumAlgo] = useState<'md5' | 'sha256'>('sha256');
  const addNotification = useAppStore((s) => s.addNotification);

  const loadDiskInfo = useCallback(async () => {
    setLoading(true);
    try {
      const [usageRes, sysRes] = await Promise.allSettled([
        systemApi.diskUsage('/'),
        systemApi.diskSystem(),
      ]);
      if (sysRes.status === 'fulfilled') {
        setDiskSystem(sysRes.value.data);
      } else {
        addNotification({ type: 'error', message: '获取系统磁盘信息失败' });
      }
      if (usageRes.status === 'fulfilled') {
        setDiskUsage(usageRes.value.data);
      }
    } catch {
      addNotification({ type: 'error', message: '获取磁盘信息失败' });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  const handleChecksum = async () => {
    if (!checksumPath) return;
    setLoading(true);
    try {
      const res = await systemApi.checksum(checksumPath, checksumAlgo);
      setChecksumResult(res.data?.checksum || JSON.stringify(res.data));
    } catch {
      addNotification({ type: 'error', message: '计算校验和失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-zinc-800 pb-2">
        <button onClick={() => { setActiveTab('disk'); loadDiskInfo(); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${activeTab === 'disk' ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-600/20' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
          <HardDrive className="w-4 h-4" />磁盘空间
        </button>
        <button onClick={() => setActiveTab('checksum')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${activeTab === 'checksum' ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-600/20' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
          <Hash className="w-4 h-4" />校验和
        </button>
      </div>

      {/* Disk Usage */}
      {activeTab === 'disk' && (
        <div className="flex-1 overflow-auto">
          {!diskSystem && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <HardDrive className="w-12 h-12 mb-2 opacity-30" />
              <p>点击上方按钮获取磁盘信息</p>
            </div>
          )}
          {diskSystem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="总容量" value={diskSystem.total} color="text-emerald-400" />
                <StatCard label="已用" value={diskSystem.used} color="text-amber-400" />
                <StatCard label="可用" value={diskSystem.available} color="text-sky-400" />
                <StatCard label="使用率" value={diskSystem.usagePercent} color="text-red-400" />
              </div>
              {diskUsage && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-zinc-300 mb-3">目录统计: {diskUsage.path}</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard label="总大小" value={diskUsage.formattedSize} color="text-emerald-400" />
                    <StatCard label="文件数" value={String(diskUsage.fileCount)} color="text-sky-400" />
                    <StatCard label="目录数" value={String(diskUsage.dirCount)} color="text-amber-400" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Checksum */}
      {activeTab === 'checksum' && (
        <div className="flex-1 overflow-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">计算文件校验和</h3>
            <div className="flex items-center gap-2 mb-3">
              <input value={checksumPath} onChange={(e) => setChecksumPath(e.target.value)} placeholder="文件路径，如 /nginx.conf"
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white outline-none focus:border-emerald-500" />
              <select value={checksumAlgo} onChange={(e) => setChecksumAlgo(e.target.value as 'md5' | 'sha256')}
                className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white outline-none">
                <option value="sha256">SHA-256</option>
                <option value="md5">MD5</option>
              </select>
              <button onClick={handleChecksum} disabled={loading || !checksumPath}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-50 transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '计算'}
              </button>
            </div>
            {checksumResult && (
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">{checksumAlgo.toUpperCase()}:</p>
                <p className="text-sm text-emerald-400 font-mono break-all">{checksumResult}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}
