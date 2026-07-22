import { useState, useEffect, useCallback } from 'react';
import { ecsApi, type EcsSecurityGroup, type EcsSecurityGroupRule } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { Shield, RefreshCw, Loader2, Plus, Trash2, X, Save, Edit3 } from 'lucide-react';

const POLICY_BADGE: Record<string, string> = {
  Accept: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  accept: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Drop: 'bg-red-500/15 text-red-400 border-red-500/30',
  drop: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const PROTOCOL_BADGE: Record<string, string> = {
  TCP: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  tcp: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  UDP: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  udp: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  ICMP: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  icmp: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

export default function EcsSecurityGroupsPage() {
  const [region, setRegion] = useState('cn-hangzhou');
  const [groups, setGroups] = useState<EcsSecurityGroup[]>([]);
  const [selectedSg, setSelectedSg] = useState<string | null>(null);
  const [rules, setRules] = useState<EcsSecurityGroupRule[]>([]);
  const [direction, setDirection] = useState<'ingress' | 'egress' | 'all'>('all');
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const emptyForm = { IpProtocol: 'TCP', PortRange: '80/80', SourceCidrIp: '0.0.0.0/0', Policy: 'Accept', Priority: '1', Description: '' };
  const [form, setForm] = useState(emptyForm);

  const addNotification = useAppStore((s) => s.addNotification);

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await ecsApi.getSecurityGroups(region);
      const list = res.data?.data || [];
      setGroups(list);
      if (!selectedSg && list.length > 0) setSelectedSg(list[0].SecurityGroupId);
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || '获取安全组失败' });
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }, [region, selectedSg, addNotification]);

  const loadRules = useCallback(async () => {
    if (!selectedSg) return;
    setLoadingRules(true);
    try {
      const res = await ecsApi.getSecurityGroupRules(selectedSg, region, direction);
      setRules(res.data?.data || []);
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || '获取规则失败' });
      setRules([]);
    } finally {
      setLoadingRules(false);
    }
  }, [selectedSg, region, direction, addNotification]);

  useEffect(() => { loadGroups(); }, [loadGroups]);
  useEffect(() => { loadRules(); }, [loadRules]);

  const handleAdd = async () => {
    if (!form.IpProtocol || !form.PortRange || !form.Policy) {
      addNotification({ type: 'error', message: '协议 / 端口范围 / 策略 不能为空' });
      return;
    }
    try {
      await ecsApi.addSecurityGroupRule(selectedSg!, { ...form }, region);
      addNotification({ type: 'success', message: '规则已添加' });
      setShowAdd(false);
      setForm(emptyForm);
      loadRules();
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || '添加失败' });
    }
  };

  const handleDelete = async (rule: EcsSecurityGroupRule) => {
    const full = `${rule.IpProtocol} ${rule.PortRange} ${rule.SourceCidrIp || rule.DestCidrIp || ''} (${rule.Policy})`;
    if (!window.confirm(`删除规则？\n${full}\n\n此操作不可恢复。`)) return;
    try {
      await ecsApi.deleteSecurityGroupRule(selectedSg!, {
        IpProtocol: rule.IpProtocol,
        PortRange: rule.PortRange,
        SourceCidrIp: rule.SourceCidrIp,
        Policy: rule.Policy,
        Priority: rule.Priority,
      }, region);
      addNotification({ type: 'success', message: '已删除' });
      loadRules();
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || '删除失败' });
    }
  };

  const startEdit = (rule: EcsSecurityGroupRule) => {
    if (!rule.SecurityGroupRuleId) {
      addNotification({ type: 'warning', message: '该规则无 RuleId（老规则），不支持编辑。请删除后新增。' });
      return;
    }
    setEditingRuleId(rule.SecurityGroupRuleId);
    setShowAdd(false);
    setForm({
      IpProtocol: rule.IpProtocol?.toUpperCase() || 'TCP',
      PortRange: rule.PortRange || '80/80',
      SourceCidrIp: rule.SourceCidrIp || '0.0.0.0/0',
      Policy: rule.Policy ? (rule.Policy.charAt(0).toUpperCase() + rule.Policy.slice(1).toLowerCase()) : 'Accept',
      Priority: rule.Priority || '1',
      Description: rule.Description || '',
    });
  };

  const handleUpdate = async () => {
    if (!form.IpProtocol || !form.PortRange || !form.Policy) {
      addNotification({ type: 'error', message: '协议 / 端口范围 / 策略 不能为空' });
      return;
    }
    try {
      await ecsApi.updateSecurityGroupRule(selectedSg!, editingRuleId!, { ...form }, region);
      addNotification({ type: 'success', message: '规则已更新' });
      setEditingRuleId(null);
      setForm(emptyForm);
      loadRules();
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || '修改失败' });
    }
  };

  const renderForm = (isEdit: boolean) => (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
      <select value={form.IpProtocol} onChange={(e) => setForm({ ...form, IpProtocol: e.target.value })}
        className="px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-white text-sm">
        {['TCP', 'UDP', 'ICMP', 'GRE', 'ALL'].map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <input value={form.PortRange} onChange={(e) => setForm({ ...form, PortRange: e.target.value })} placeholder="端口范围 80/80 或 80/90" className="px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-white text-sm col-span-2" />
      <input value={form.SourceCidrIp} onChange={(e) => setForm({ ...form, SourceCidrIp: e.target.value })} placeholder="来源 CIDR 0.0.0.0/0" className="px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-white text-sm col-span-2" />
      <select value={form.Policy} onChange={(e) => setForm({ ...form, Policy: e.target.value })}
        className="px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-white text-sm">
        <option value="Accept">Accept</option>
        <option value="Drop">Drop</option>
      </select>
      <input value={form.Priority} onChange={(e) => setForm({ ...form, Priority: e.target.value })} placeholder="优先级 1-100" className="px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-white text-sm" />
      <input value={form.Description} onChange={(e) => setForm({ ...form, Description: e.target.value })} placeholder="描述" className="px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-white text-sm col-span-4" />
      <div className="col-span-6 flex gap-2 justify-end">
        <button
          onClick={() => { isEdit ? handleUpdate() : handleAdd(); }}
          className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm flex items-center gap-1"
        >
          <Save className="w-3.5 h-3.5" /> {isEdit ? '保存修改' : '添加'}
        </button>
        <button
          onClick={() => { isEdit ? setEditingRuleId(null) : setShowAdd(false); setForm(emptyForm); }}
          className="px-4 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-sm flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" /> 取消
        </button>
      </div>
    </div>
  );

  const filtered = rules.filter(r => direction === 'all' ? true : r.Direction === direction);

  return (
    <div className="flex flex-col h-full overflow-hidden p-4">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">安全组</h2>
          <span className="text-xs text-zinc-500">阿里云 ECS Security Group</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={region}
            onChange={(e) => { setRegion(e.target.value); setSelectedSg(null); }}
            className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500 w-40"
            placeholder="地域 ID"
          />
          <button onClick={() => { loadGroups(); loadRules(); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm">
            <RefreshCw className="w-4 h-4" /> 刷新
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden">
        {/* 左：安全组列表 */}
        <div className="w-72 shrink-0 overflow-y-auto bg-zinc-900/40 border border-zinc-800 rounded-lg">
          <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800 sticky top-0 bg-zinc-900/80">
            安全组 ({groups.length})
          </div>
          {loadingGroups ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-emerald-500" /></div>
          ) : groups.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 text-xs">暂无安全组</div>
          ) : (
            groups.map(sg => (
              <button
                key={sg.SecurityGroupId}
                onClick={() => setSelectedSg(sg.SecurityGroupId)}
                className={`w-full text-left px-3 py-2 border-b border-zinc-900 transition-colors ${
                  selectedSg === sg.SecurityGroupId ? 'bg-emerald-600/15 border-l-2 border-l-emerald-500' : 'hover:bg-zinc-800/40'
                }`}
              >
                <div className="font-mono text-xs text-emerald-400 truncate">{sg.SecurityGroupId}</div>
                <div className="text-xs text-zinc-400 truncate">{sg.Description || sg.SecurityGroupName || '-'}</div>
                <div className="text-xs text-zinc-600 truncate">VPC: {sg.VpcId?.slice(0, 24) || '-'}</div>
              </button>
            ))
          )}
        </div>

        {/* 右：规则列表 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedSg ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500">
              <Shield className="w-12 h-12 opacity-30 mr-2" /> 选择左侧安全组查看规则
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  {(['all', 'ingress', 'egress'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setDirection(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs ${
                        direction === d ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {d === 'all' ? '全部' : d === 'ingress' ? '入方向' : '出方向'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setShowAdd(true); setForm(emptyForm); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
                >
                  <Plus className="w-4 h-4" /> 新增规则
                </button>
              </div>

              {showAdd && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-white">新增规则 → {selectedSg}</h3>
                    <button onClick={() => setShowAdd(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                  </div>
                  {renderForm(false)}
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {loadingRules ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-6 text-zinc-500 text-sm">无规则</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-zinc-950">
                      <tr className="text-left text-zinc-500 border-b border-zinc-800">
                        <th className="py-2 px-2 font-medium">协议</th>
                        <th className="py-2 px-2 font-medium">端口范围</th>
                        <th className="py-2 px-2 font-medium">来源 / 目标</th>
                        <th className="py-2 px-2 font-medium">策略</th>
                        <th className="py-2 px-2 font-medium">优先级</th>
                        <th className="py-2 px-2 font-medium">方向</th>
                        <th className="py-2 px-2 font-medium">描述</th>
                        <th className="py-2 px-2 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r, idx) => {
                        const rowKey = (r.SecurityGroupRuleId || '') + idx;
                        if (editingRuleId && editingRuleId === r.SecurityGroupRuleId) {
                          return (
                            <tr key={rowKey} className="bg-zinc-900/40">
                              <td colSpan={8} className="py-3 px-3">
                                <div className="text-xs text-zinc-500 mb-2">
                                  编辑规则 <span className="font-mono text-emerald-400">{r.SecurityGroupRuleId}</span>
                                  <span className="ml-2">原: {r.IpProtocol} {r.PortRange} {r.SourceCidrIp} ({r.Policy})</span>
                                </div>
                                {renderForm(true)}
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={rowKey} className="border-b border-zinc-900 hover:bg-zinc-900/60">
                            <td className="py-2 px-2">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono border ${PROTOCOL_BADGE[r.IpProtocol] || PROTOCOL_BADGE.ICMP}`}>{r.IpProtocol}</span>
                            </td>
                            <td className="py-2 px-2 font-mono text-zinc-300">{r.PortRange}</td>
                            <td className="py-2 px-2 font-mono text-zinc-400 text-xs">{r.SourceCidrIp || r.DestCidrIp || '-'}</td>
                            <td className="py-2 px-2">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs border ${POLICY_BADGE[r.Policy] || POLICY_BADGE.Drop}`}>{r.Policy}</span>
                            </td>
                            <td className="py-2 px-2 font-mono text-zinc-500">{r.Priority}</td>
                            <td className="py-2 px-2 text-xs text-zinc-500">{r.Direction === 'ingress' ? '入' : r.Direction === 'egress' ? '出' : r.Direction}</td>
                            <td className="py-2 px-2 text-zinc-400 text-xs">{r.Description || '-'}</td>
                            <td className="py-2 px-2 text-right whitespace-nowrap">
                              <button
                                onClick={() => startEdit(r)}
                                disabled={!r.SecurityGroupRuleId}
                                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed"
                                title={r.SecurityGroupRuleId ? '编辑' : '老规则不支持编辑，请删除后新增'}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(r)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 ml-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
