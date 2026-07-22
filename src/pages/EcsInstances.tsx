import { useState, useEffect, useCallback } from 'react';
import { ecsApi, type EcsInstance, type EcsRegion } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { Server, RefreshCw, Loader2, Play, Square, RotateCw, ChevronDown, ChevronRight, AlertTriangle, Save } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  Running: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Stopped: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  Stopping: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Starting: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

export default function EcsInstancesPage() {
  const { settings, updateSettings } = useAuthStore();
  const [regions, setRegions] = useState<EcsRegion[]>([]);
  const [region, setRegion] = useState(settings?.ecs_region || 'cn-hangzhou');
  const [instances, setInstances] = useState<EcsInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const addNotification = useAppStore((s) => s.addNotification);

  const loadRegions = useCallback(async () => {
    try {
      const res = await ecsApi.getRegions();
      setRegions(res.data?.data || []);
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || '获取地域失败' });
    }
  }, [addNotification]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ecsApi.getInstances(region);
      setInstances(res.data?.data || []);
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || '获取实例失败' });
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, [region, addNotification]);

  useEffect(() => { loadRegions(); }, [loadRegions]);
  useEffect(() => { load(); }, [load]);

  const confirmSelf = (action: string) =>
    `⚠️ 危险操作\n\n这台 ECS 跑着 flux 管理后台本身！${action} 后后台将立即下线，需通过阿里云控制台或等待 60s 才能恢复。\n\n输入"确认"才能继续。`;

  const doAction = async (inst: EcsInstance, action: 'start' | 'stop' | 'reboot') => {
    const actionText = { start: '启动', stop: '停止', reboot: '重启' }[action];
    let confirmed = false;

    if (inst.IsSelf) {
      const input = window.prompt(confirmSelf(actionText));
      confirmed = input === '确认';
      if (!confirmed) {
        addNotification({ type: 'info', message: '已取消（自伤保护）' });
        return;
      }
    } else {
      confirmed = window.confirm(`确认${actionText}实例 ${inst.InstanceName} (${inst.InstanceId})？`);
      if (!confirmed) return;
    }

    setActing(inst.InstanceId);
    try {
      let res;
      if (action === 'start') res = await ecsApi.startInstance(inst.InstanceId, region);
      else if (action === 'stop') res = await ecsApi.stopInstance(inst.InstanceId, region, { forceStop: false });
      else res = await ecsApi.rebootInstance(inst.InstanceId, region, { forceStop: false });

      if (res.data?.warning === 'self') {
        addNotification({ type: 'warning', message: `${actionText}指令已发送（自伤：即将断连）` });
      } else {
        addNotification({ type: 'success', message: `${actionText}指令已发送` });
      }
      setTimeout(load, 2000);
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || `${actionText}失败` });
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-4">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">ECS 实例</h2>
          <span className="text-xs text-zinc-500">阿里云 ECS</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {regions.length === 0 && <option value={region}>{region}</option>}
            {regions.map((r) => (
              <option key={r.RegionId} value={r.RegionId}>
                {r.LocalName} ({r.RegionId})
              </option>
            ))}
          </select>
          {region !== settings?.ecs_region && (
            <button
              onClick={async () => {
                try {
                  await updateSettings({ ecs_region: region });
                  addNotification({ type: 'success', message: '已保存为默认地域' });
                } catch {
                  addNotification({ type: 'error', message: '保存失败' });
                }
              }}
              className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition-colors"
              title="保存为默认地域"
            >
              <Save className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 刷新
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : instances.length === 0 ? (
        <div className="text-center py-12 text-zinc-500"><Server className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>该地域暂无 ECS 实例</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 px-2 font-medium w-8"></th>
                <th className="py-2 px-2 font-medium">实例名 / ID</th>
                <th className="py-2 px-2 font-medium">状态</th>
                <th className="py-2 px-2 font-medium">规格</th>
                <th className="py-2 px-2 font-medium">公网 IP</th>
                <th className="py-2 px-2 font-medium">内网 IP</th>
                <th className="py-2 px-2 font-medium">到期</th>
                <th className="py-2 px-2 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((inst) => (
                <>
                  <tr key={inst.InstanceId} className="border-b border-zinc-900 hover:bg-zinc-900/60">
                    <td className="py-2 px-2">
                      <button onClick={() => setExpandedId(expandedId === inst.InstanceId ? null : inst.InstanceId)} className="text-zinc-500 hover:text-white">
                        {expandedId === inst.InstanceId ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-emerald-400">{inst.InstanceName || '(unnamed)'}</span>
                        {inst.IsSelf && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> 本机
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 font-mono">{inst.InstanceId}</div>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs border ${STATUS_BADGE[inst.Status] || STATUS_BADGE.Stopped}`}>
                        {inst.Status}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-mono text-zinc-300 whitespace-nowrap">
                      {inst.InstanceType}
                      <div className="text-xs text-zinc-500">{inst.CPU}C / {inst.Memory}MB</div>
                    </td>
                    <td className="py-2 px-2 font-mono text-zinc-300">{inst.PublicIp || inst.EipAddress || '-'}</td>
                    <td className="py-2 px-2 font-mono text-zinc-500">{inst.PrivateIp || '-'}</td>
                    <td className="py-2 px-2 text-zinc-500 whitespace-nowrap text-xs">{inst.ExpiredTime?.slice(0, 10) || '-'}</td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => doAction(inst, 'start')}
                        disabled={acting === inst.InstanceId || inst.Status === 'Running'}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="启动"
                      ><Play className="w-3.5 h-3.5" /></button>
                      <button
                        onClick={() => doAction(inst, 'stop')}
                        disabled={acting === inst.InstanceId || inst.Status !== 'Running'}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed ml-1"
                        title="停止"
                      ><Square className="w-3.5 h-3.5" /></button>
                      <button
                        onClick={() => doAction(inst, 'reboot')}
                        disabled={acting === inst.InstanceId || inst.Status !== 'Running'}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed ml-1"
                        title="重启"
                      ><RotateCw className={`w-3.5 h-3.5 ${acting === inst.InstanceId ? 'animate-spin' : ''}`} /></button>
                    </td>
                  </tr>
                  {expandedId === inst.InstanceId && (
                    <tr key={inst.InstanceId + '-detail'} className="bg-zinc-900/40">
                      <td colSpan={8} className="py-3 px-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                          <Detail label="地域 / 可用区" value={`${inst.RegionId} / ${inst.ZoneId}`} />
                          <Detail label="OS" value={inst.OSName || '-'} />
                          <Detail label="镜像 ID" value={inst.ImageId} mono />
                          <Detail label="主机名" value={inst.HostName || '-'} mono />
                          <Detail label="网络类型" value={inst.InstanceNetworkType} />
                          <Detail label="计费方式" value={inst.InstanceChargeType === 'PrePaid' ? '包年包月' : inst.InstanceChargeType === 'PostPaid' ? '按量付费' : inst.InstanceChargeType} />
                          <Detail label="创建时间" value={inst.CreationTime?.slice(0, 19).replace('T', ' ') || '-'} />
                          <Detail label="到期时间" value={inst.ExpiredTime?.slice(0, 19).replace('T', ' ') || '-'} />
                          <div className="col-span-2 md:col-span-4">
                            <span className="text-zinc-500">安全组：</span>
                            {inst.SecurityGroupIds.map(sg => (
                              <span key={sg} className="ml-2 inline-block px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-xs">{sg}</span>
                            ))}
                          </div>
                          {inst.Description && (
                            <div className="col-span-2 md:col-span-4">
                              <span className="text-zinc-500">描述：</span>
                              <span className="text-zinc-300 ml-2">{inst.Description}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-zinc-500">{label}: </span>
      <span className={`text-zinc-300 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
