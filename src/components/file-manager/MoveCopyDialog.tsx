import { useState } from 'react';
import { fileApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { X, Scissors, Copy, Loader2, Folder } from 'lucide-react';

interface MoveCopyDialogProps {
  selectedPaths: string[];
  currentPath?: string;
  mode: 'move' | 'copy';
  onClose: () => void;
  onSuccess: () => void;
}

export default function MoveCopyDialog({ selectedPaths, mode, onClose, onSuccess }: MoveCopyDialogProps) {
  const [targetPath, setTargetPath] = useState('/');
  const [loading, setLoading] = useState(false);
  const addNotification = useAppStore((s) => s.addNotification);
  const isMove = mode === 'move';

  const handleAction = async () => {
    setLoading(true);
    try {
      for (const fromPath of selectedPaths) {
        const name = fromPath.split('/').pop() || '';
        const toPath = targetPath === '/' ? `/${name}` : `${targetPath}/${name}`;
        if (isMove) {
          await fileApi.move(fromPath, toPath);
        } else {
          await fileApi.copy(fromPath, toPath);
        }
      }
      addNotification({ type: 'success', message: isMove ? '移动完成' : '复制完成' });
      onSuccess();
      onClose();
    } catch {
      addNotification({ type: 'error', message: isMove ? '移动失败' : '复制失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            {isMove ? <Scissors className="w-5 h-5 text-amber-400" /> : <Copy className="w-5 h-5 text-sky-400" />}
            {isMove ? '移动' : '复制'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-zinc-400 mb-3">{selectedPaths.length} 个项目</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block flex items-center gap-1"><Folder className="w-3 h-3" />目标目录</label>
            <input value={targetPath} onChange={(e) => setTargetPath(e.target.value)} placeholder="/target/path"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white outline-none focus:border-emerald-500 font-mono" autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAction()} />
          </div>
          <button onClick={handleAction} disabled={loading || !targetPath}
            className={`w-full py-2.5 rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2 ${
              isMove ? 'bg-amber-600 hover:bg-amber-500' : 'bg-sky-600 hover:bg-sky-500'
            } text-white`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isMove ? <Scissors className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {isMove ? '移动' : '复制'}
          </button>
        </div>
      </div>
    </div>
  );
}
