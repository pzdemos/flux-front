import { useState, useEffect, useCallback } from 'react';
import { trashApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { Trash2, RotateCcw, Loader2, AlertTriangle, File as FileIcon } from 'lucide-react';
import type { TrashItem } from '@/types';

export default function TrashView() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [_selected, _setSelected] = useState<Set<string>>(new Set());
  const addNotification = useAppStore((s) => s.addNotification);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await trashApi.list();
      // Ensure items is always an array
      const data = res.data;
      if (Array.isArray(data)) {
        setItems(data);
      } else if (data && typeof data === 'object' && 'items' in data && Array.isArray(data.items)) {
        setItems(data.items);
      } else {
        console.warn('[TrashView] Unexpected data format:', data);
        setItems([]);
      }
    } catch (err) {
      console.error('[TrashView] Load error:', err);
      addNotification({ type: 'error', message: '获取回收站失败' });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { load(); }, [load]);

  const handleRestore = async (id: string) => {
    try {
      await trashApi.restore(id);
      addNotification({ type: 'success', message: '文件已恢复' });
      load();
    } catch {
      addNotification({ type: 'error', message: '恢复失败' });
    }
  };

  const handleDelete = async (id: string) => {
    const c = window.confirm('确定要永久删除此文件？此操作不可撤销！');
    if (!c) return;
    try {
      await trashApi.permanentDelete(id);
      addNotification({ type: 'success', message: '已永久删除' });
      load();
    } catch {
      addNotification({ type: 'error', message: '删除失败' });
    }
  };

  const handleClearAll = async () => {
    const c = window.confirm('确定要清空回收站？所有文件将被永久删除！');
    if (!c) return;
    try {
      await trashApi.clear();
      addNotification({ type: 'success', message: '回收站已清空' });
      load();
    } catch {
      addNotification({ type: 'error', message: '清空失败' });
    }
  };

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-red-400" />
          回收站
          <span className="text-sm text-zinc-500 font-normal">({items.length})</span>
        </h2>
        {items.length > 0 && (
          <button onClick={handleClearAll} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm transition-colors">
            清空回收站
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-3 text-zinc-600" />
            <p className="text-zinc-400 text-base">回收站为空</p>
            <p className="text-zinc-500 text-sm mt-1">删除的文件会显示在这里</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800/50 transition-colors">
              <FileIcon className="w-5 h-5 text-zinc-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 truncate">{item.originalPath}</p>
                <p className="text-xs text-zinc-500">删除于 {item.deletedAt}</p>
              </div>
              <button onClick={() => handleRestore(item.id)} className="p-2 rounded hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 transition-colors" title="恢复">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(item.id)} className="p-2 rounded hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors" title="永久删除">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
