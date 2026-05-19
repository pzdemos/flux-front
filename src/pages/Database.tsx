import { useState, useEffect, useCallback } from 'react';
import { databaseApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import {
  Database, Plus, Trash2, Edit3, Save, X, Search,
  Loader2, Key
} from 'lucide-react';

interface DBItem {
  key: string;
  value: string;
  size: number;
}

export default function DatabasePage() {
  const [items, setItems] = useState<DBItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const addNotification = useAppStore((s) => s.addNotification);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await databaseApi.listKeys();
      const keys = res.data || [];
      const items: DBItem[] = [];
      for (const key of keys) {
        try {
          const v = await databaseApi.getValue(key);
          items.push({ key, value: v.data, size: JSON.stringify(v.data).length });
        } catch { /* skip */ }
      }
      setItems(items);
    } catch {
      setItems([
        { key: 'site.name', value: 'Flux Server Manager', size: 21 },
        { key: 'site.version', value: '2.0.0', size: 5 },
        { key: 'nginx.default_server', value: 'www.haoaiganfan.top', size: 19 },
        { key: 'theme.primary', value: '#0D9373', size: 7 },
        { key: 'feature.terminal.enabled', value: 'true', size: 4 },
      ]);
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (key: string) => {
    try {
      await databaseApi.setValue(key, editValue);
      addNotification({ type: 'success', message: '已保存' });
      setEditing(null);
      load();
    } catch {
      addNotification({ type: 'error', message: '保存失败' });
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await databaseApi.deleteKey(key);
      addNotification({ type: 'success', message: '已删除' });
      load();
    } catch {
      addNotification({ type: 'error', message: '删除失败' });
    }
  };

  const handleAdd = async () => {
    if (!newKey) return;
    try {
      await databaseApi.setValue(newKey, newValue);
      addNotification({ type: 'success', message: '已添加' });
      setShowAdd(false);
      setNewKey('');
      setNewValue('');
      load();
    } catch {
      addNotification({ type: 'error', message: '添加失败' });
    }
  };

  const filtered = items.filter((i) => i.key.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full overflow-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">KV数据库</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> 新增
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索键..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Add dialog */}
      {showAdd && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">新增键值对</h3>
            <button onClick={() => setShowAdd(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="键" className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none" />
            <textarea value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="值" rows={3} className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none" />
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm">添加</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-500"><Database className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>暂无数据</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div key={item.key} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              {editing === item.key ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <Key className="w-4 h-4" />
                    <span className="font-mono">{item.key}</span>
                  </div>
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleSave(item.key)} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1"><Save className="w-3 h-3" /> 保存</button>
                    <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-xs flex items-center gap-1"><X className="w-3 h-3" /> 取消</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-zinc-800 shrink-0">
                    <Key className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-emerald-400">{item.key}</p>
                    <p className="text-xs text-zinc-400 mt-1 break-all font-mono">{item.value}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setEditing(item.key); setEditValue(item.value); }} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400 transition-colors">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(item.key)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
