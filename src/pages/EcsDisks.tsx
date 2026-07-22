import { useState, useEffect, useCallback } from 'react';
import { ecsApi, type EcsDisk } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { HardDrive, RefreshCw, Loader2, Link2, Unlink } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  In_use: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Available: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  Attaching: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Detaching: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Creating: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const TYPE_BADGE: Record<string, string> = {
  system: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  data: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const CATEGORY_LABEL: Record<string, string> = {
  cloud_essd_entry: 'ESSD Entry',
  cloud_essd: 'ESSD',
  cloud_ssd: 'SSD',
  cloud_efficiency: '高效云盘',
  cloud: '普通云盘',
  cloud_auto: 'ESSD AutoPL',
};

export default function EcsDisksPage() {
  const [region, setRegion] = useState('cn-hangzhou');
  const [disks, setDisks] = useState<EcsDisk[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const addNotification = useAppStore((s) => s.addNotification);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ecsApi.getDisks(region);
      setDisks(res.data?.data || []);
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || '获取云盘失败' });
      setDisks([]);
    } finally {
      setLoading(false);
    }
  }, [region, addNotification]);

  useEffect(() => { load(); }, [load]);

  const handleAttach = async (disk: EcsDisk) => {
    const instanceId = window.prompt(`挂载云盘 ${disk.DiskId} (${disk.Size}GB)\n\n请输入目标实例 ID：`);
    if (!instanceId) return;
    setActing(disk.DiskId);
    try {
      await ecsApi.attachDisk(disk.DiskId, { instanceId }, region);
      addNotification({ type: 'success', message: '挂载指令已发送' });
      setTimeout(load, 3000);
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || '挂载失败' });
    } finally {
      setActing(null);
    }
  };

  const handleDetach = async (disk: EcsDisk) => {
    if (!disk.InstanceId) {
      addNotification({ type: 'info', message: '该云盘未挂载' });
      return;
    }
    if (!window.confirm(`卸载云盘 ${disk.DiskId} (从 ${disk.InstanceId})？\n\n注意：系统盘不能卸载。卸载数据盘前请先在 OS 内 umount。`)) return;
    setActing(disk.DiskId);
    try {
      await ecsApi.detachDisk(disk.DiskId, { instanceId: disk.InstanceId }, region);
      addNotification({ type: 'success', message: '卸载指令已发送' });
      setTimeout(load, 3000);
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || '卸载失败' });
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-4">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">云盘</h2>
          <span className="text-xs text-zinc-500">阿里云 ECS Disk</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500 w-40"
            placeholder="地域 ID"
          />
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 刷新
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : disks.length === 0 ? (
        <div className="text-center py-12 text-zinc-500"><HardDrive className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>该地域暂无云盘</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 px-2 font-medium">云盘 ID / 名称</th>
                <th className="py-2 px-2 font-medium">大小</th>
                <th className="py-2 px-2 font-medium">类型</th>
                <th className="py-2 px-2 font-medium">用途</th>
                <th className="py-2 px-2 font-medium">状态</th>
                <th className="py-2 px-2 font-medium">挂载实例</th>
                <th className="py-2 px-2 font-medium">设备</th>
                <th className="py-2 px-2 font-medium">计费</th>
                <th className="py-2 px-2 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {disks.map(d => (
                <tr key={d.DiskId} className="border-b border-zinc-900 hover:bg-zinc-900/60">
                  <td className="py-2 px-2">
                    <div className="font-mono text-emerald-400 text-xs">{d.DiskId}</div>
                    <div className="text-xs text-zinc-500">{d.DiskName || d.Description || '-'}</div>
                  </td>
                  <td className="py-2 px-2 font-mono text-zinc-300 whitespace-nowrap">{d.Size} GB</td>
                  <td className="py-2 px-2 text-zinc-300 whitespace-nowrap">{CATEGORY_LABEL[d.Category] || d.Category}</td>
                  <td className="py-2 px-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono border ${TYPE_BADGE[d.Type] || TYPE_BADGE.data}`}>
                      {d.Type === 'system' ? '系统盘' : '数据盘'}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs border ${STATUS_BADGE[d.Status] || STATUS_BADGE.Available}`}>{d.Status}</span>
                  </td>
                  <td className="py-2 px-2 font-mono text-zinc-400 text-xs">
                    {d.InstanceId ? (
                      <>
                        {d.InstanceId}
                        {d.DeleteWithInstance && <span className="ml-1 text-zinc-600">(随实例删)</span>}
                      </>
                    ) : <span className="text-zinc-600">未挂载</span>}
                  </td>
                  <td className="py-2 px-2 font-mono text-zinc-500 text-xs">{d.Device || '-'}</td>
                  <td className="py-2 px-2 text-zinc-500 text-xs whitespace-nowrap">
                    {d.DiskChargeType === 'PrePaid' ? '包年包月' : d.DiskChargeType === 'PostPaid' ? '按量付费' : d.DiskChargeType}
                  </td>
                  <td className="py-2 px-2 text-right whitespace-nowrap">
                    {d.Type !== 'system' && (
                      d.Status === 'Available' ? (
                        <button
                          onClick={() => handleAttach(d)}
                          disabled={acting === d.DiskId}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400 disabled:opacity-30"
                          title="挂载"
                        ><Link2 className="w-3.5 h-3.5" /></button>
                      ) : d.Status === 'In_use' ? (
                        <button
                          onClick={() => handleDetach(d)}
                          disabled={acting === d.DiskId}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-amber-400 disabled:opacity-30 ml-1"
                          title="卸载"
                        ><Unlink className="w-3.5 h-3.5" /></button>
                      ) : null
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
