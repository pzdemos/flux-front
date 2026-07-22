import { useState, useEffect, useCallback } from 'react';
import { dnsApi, type DnsRecordInput } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { Globe, Plus, Trash2, Edit3, Save, X, RefreshCw, Loader2 } from 'lucide-react';

interface DnsRecord {
  RecordId: string;
  RR: string;
  Type: string;
  Value: string;
  TTL: number;
  Priority?: number;
  Status?: string;
  Locked?: boolean;
}

interface Domain {
  DomainName: string;
  RecordCount?: number;
  AliDomain?: boolean;
}

const TYPE_BADGE: Record<string, string> = {
  A: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  AAAA: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  CNAME: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  TXT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  MX: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  NS: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  SRV: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  CAA: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  PTR: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
};

const TYPE_OPTIONS = ['A', 'CNAME', 'TXT', 'MX', 'AAAA', 'NS', 'SRV', 'CAA', 'PTR'];

export default function DnsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domain, setDomain] = useState('');
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const emptyForm: DnsRecordInput = { RR: '', Type: 'A', Value: '', TTL: 600 };
  const [form, setForm] = useState<DnsRecordInput>(emptyForm);

  const addNotification = useAppStore((s) => s.addNotification);

  const loadDomains = useCallback(async () => {
    try {
      const res = await dnsApi.getDomains();
      const list: Domain[] = res.data?.data || [];
      setDomains(list);
      if (!domain && list.length > 0) setDomain(list[0].DomainName);
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || '获取域名列表失败' });
    }
  }, [domain, addNotification]);

  const loadRecords = useCallback(async () => {
    if (!domain) return;
    setLoading(true);
    try {
      const res = await dnsApi.getRecords(domain);
      const list: DnsRecord[] = res.data?.data || [];
      list.sort((a, b) => {
        if (a.Type !== b.Type) return a.Type.localeCompare(b.Type);
        return a.RR.localeCompare(b.RR);
      });
      setRecords(list);
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || '获取解析记录失败' });
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [domain, addNotification]);

  useEffect(() => { loadDomains(); }, [loadDomains]);
  useEffect(() => { if (domain) loadRecords(); }, [domain, loadRecords]);

  const handleAdd = async () => {
    if (!form.RR || !form.Type || !form.Value) {
      addNotification({ type: 'error', message: 'RR / Type / Value 不能为空' });
      return;
    }
    try {
      await dnsApi.addRecord({ ...form, DomainName: domain });
      addNotification({ type: 'success', message: `已新增 ${form.RR}.${domain}` });
      setShowAdd(false);
      setForm(emptyForm);
      loadRecords();
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || '新增失败' });
    }
  };

  const handleUpdate = async (recordId: string) => {
    if (!form.RR || !form.Type || !form.Value) {
      addNotification({ type: 'error', message: 'RR / Type / Value 不能为空' });
      return;
    }
    try {
      await dnsApi.updateRecord(recordId, form);
      addNotification({ type: 'success', message: '已修改' });
      setEditingId(null);
      loadRecords();
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || '修改失败' });
    }
  };

  const handleDelete = async (rec: DnsRecord) => {
    const full = rec.RR === '@' ? domain : `${rec.RR}.${domain}`;
    if (!window.confirm(`删除 ${full} 的 ${rec.Type} 记录？\n值：${rec.Value}\n\n此操作不可恢复，会真实落到阿里云 DNS。`)) return;
    try {
      await dnsApi.deleteRecord(rec.RecordId, domain);
      addNotification({ type: 'success', message: '已删除' });
      loadRecords();
    } catch (err: any) {
      addNotification({ type: 'error', message: err?.response?.data?.error || '删除失败' });
    }
  };

  const startEdit = (rec: DnsRecord) => {
    setEditingId(rec.RecordId);
    setForm({ RR: rec.RR, Type: rec.Type, Value: rec.Value, TTL: rec.TTL, Priority: rec.Priority });
    setShowAdd(false);
  };

  const startAdd = () => {
    setShowAdd(true);
    setEditingId(null);
    setForm(emptyForm);
  };

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    return r.RR.toLowerCase().includes(q) || r.Value.toLowerCase().includes(q) || r.Type.toLowerCase().includes(q);
  });

  const renderForm = (isEdit: boolean, recordId?: string) => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
        <input
          value={form.RR}
          onChange={(e) => setForm({ ...form, RR: e.target.value })}
          placeholder="主机记录（@ 或 www、api 等）"
          className="md:col-span-4 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <select
          value={form.Type}
          onChange={(e) => setForm({ ...form, Type: e.target.value })}
          className="md:col-span-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          value={form.Value}
          onChange={(e) => setForm({ ...form, Value: e.target.value })}
          placeholder="记录值（IP / CNAME / 文本）"
          className="md:col-span-4 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <input
          value={form.TTL ?? ''}
          onChange={(e) => setForm({ ...form, TTL: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="TTL"
          type="number"
          className="md:col-span-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>
      {form.Type === 'MX' && (
        <input
          value={form.Priority ?? ''}
          onChange={(e) => setForm({ ...form, Priority: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="MX 优先级（如 10）"
          type="number"
          className="w-full md:w-64 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500"
        />
      )}
      <div className="flex gap-2">
        <button
          onClick={() => (isEdit && recordId ? handleUpdate(recordId) : handleAdd())}
          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm flex items-center gap-1"
        >
          <Save className="w-3.5 h-3.5" /> {isEdit ? '保存修改' : '添加'}
        </button>
        <button
          onClick={() => { isEdit ? setEditingId(null) : setShowAdd(false); setForm(emptyForm); }}
          className="px-4 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" /> 取消
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-auto p-4">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">DNS 解析管理</h2>
          <span className="text-xs text-zinc-500">阿里云 Alidns</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {domains.length === 0 && <option value="">加载中...</option>}
            {domains.map((d) => (
              <option key={d.DomainName} value={d.DomainName}>
                {d.DomainName} ({d.RecordCount ?? 0} 条)
              </option>
            ))}
          </select>
          <button
            onClick={loadRecords}
            disabled={loading || !domain}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 刷新
          </button>
          <button
            onClick={startAdd}
            disabled={!domain}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> 新增
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="按主机记录/值/类型搜索..."
          className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {showAdd && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">新增解析记录 <span className="text-zinc-500 ml-1">→ {domain}</span></h3>
            <button onClick={() => { setShowAdd(false); setForm(emptyForm); }} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          {renderForm(false)}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-500"><Globe className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>暂无解析记录</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 px-2 font-medium">类型</th>
                <th className="py-2 px-2 font-medium">主机记录</th>
                <th className="py-2 px-2 font-medium">记录值</th>
                <th className="py-2 px-2 font-medium">TTL</th>
                <th className="py-2 px-2 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec) => (
                <tr key={rec.RecordId} className="border-b border-zinc-900 hover:bg-zinc-900/60">
                  {editingId === rec.RecordId ? (
                    <td colSpan={5} className="py-3 px-2">
                      <div className="text-xs text-zinc-500 mb-2">编辑 <span className="text-emerald-400 font-mono">{rec.RR}.{domain}</span></div>
                      {renderForm(true, rec.RecordId)}
                    </td>
                  ) : (
                    <>
                      <td className="py-2 px-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono border ${TYPE_BADGE[rec.Type] || TYPE_BADGE.PTR}`}>
                          {rec.Type}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-mono text-emerald-400 whitespace-nowrap">
                        {rec.RR === '@' ? <span className="text-zinc-300">@ <span className="text-zinc-500">(根域)</span></span> : rec.RR}
                        {rec.Status && rec.Status !== 'Enable' && (
                          <span className="ml-2 text-xs text-amber-500">[停用]</span>
                        )}
                      </td>
                      <td className="py-2 px-2 font-mono text-zinc-300 break-all">
                        {rec.Value}
                        {rec.Type === 'MX' && rec.Priority !== undefined && (
                          <span className="ml-2 text-xs text-zinc-500">优先级 {rec.Priority}</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-zinc-500 whitespace-nowrap">{rec.TTL}</td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => startEdit(rec)}
                          disabled={rec.Locked}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={rec.Locked ? '系统锁定记录，不可改' : '编辑'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(rec)}
                          disabled={rec.Locked}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={rec.Locked ? '系统锁定记录，不可删' : '删除'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
