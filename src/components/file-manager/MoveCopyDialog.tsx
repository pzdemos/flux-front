import { useState } from 'react';
import { fileApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { X, Scissors, Copy, Loader2, Folder, FolderOpen, ChevronRight } from 'lucide-react';

interface MoveCopyDialogProps {
  selectedPaths: string[];
  currentPath?: string;
  mode: 'move' | 'copy';
  onClose: () => void;
  onSuccess: () => void;
}

export default function MoveCopyDialog({ selectedPaths, mode, onClose, onSuccess }: MoveCopyDialogProps) {
  const [targetPath, setTargetPath] = useState<string>('/');
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
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            {isMove ? <Scissors className="w-5 h-5 text-amber-400" /> : <Copy className="w-5 h-5 text-sky-400" />}
            {isMove ? '移动到' : '复制到'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-sm text-zinc-400 mb-3">{selectedPaths.length} 个项目</p>

        {/* Source files display */}
        <div className="mb-4 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
          <p className="text-xs text-zinc-500 mb-2">源文件</p>
          {selectedPaths.slice(0, 3).map((path, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-zinc-300 truncate">
              <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
              <span className="font-mono truncate">{path.split('/').pop()}</span>
            </div>
          ))}
          {selectedPaths.length > 3 && (
            <p className="text-xs text-zinc-500 mt-1">还有 {selectedPaths.length - 3} 个文件...</p>
          )}
        </div>

        {/* Target directory selector */}
        <div className="mb-4">
          <label className="text-xs text-zinc-500 mb-2 block flex items-center gap-1">
            <Folder className="w-3 h-3" />目标目录
          </label>
          <button
            onClick={() => {
              const picker = document.createElement('div');
              document.body.appendChild(picker);
              // We'll use DirectoryPicker inline instead
            }}
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white text-left flex items-center justify-between hover:border-emerald-500 transition-colors"
          >
            <span className="font-mono truncate">{targetPath}</span>
            <FolderOpen className="w-4 h-4 text-zinc-400 shrink-0" />
          </button>
        </div>

        {/* Directory picker inline */}
        <div className="mb-4 p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50 max-h-48 overflow-auto">
          <SimplePathSelector onSelect={setTargetPath} currentPath={targetPath} />
        </div>

        {/* Actions */}
        <button
          onClick={handleAction}
          disabled={loading}
          className={`w-full py-2.5 rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2 ${
            isMove ? 'bg-amber-600 hover:bg-amber-500' : 'bg-sky-600 hover:bg-sky-500'
          } text-white`}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isMove ? <Scissors className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {isMove ? '移动' : '复制'}
        </button>
      </div>
    </div>
  );
}

// Simple inline path selector
function SimplePathSelector({ onSelect, currentPath }: { onSelect: (path: string) => void; currentPath: string }) {
  const [path, setPath] = useState(currentPath);

  return (
    <div className="space-y-1">
      {/* Quick paths */}
      <button
        onClick={() => { setPath('/'); onSelect('/'); }}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
          path === '/' ? 'bg-emerald-600/20 text-emerald-400' : 'hover:bg-zinc-700 text-zinc-300'
        }`}
      >
        <Folder className="w-4 h-4 text-amber-400" />
        <span>/ 根目录</span>
      </button>
      <button
        onClick={() => { setPath('/home'); onSelect('/home'); }}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
          path === '/home' ? 'bg-emerald-600/20 text-emerald-400' : 'hover:bg-zinc-700 text-zinc-300'
        }`}
      >
        <Folder className="w-4 h-4 text-amber-400" />
        <span>/home</span>
      </button>
      <button
        onClick={() => { setPath('/var'); onSelect('/var'); }}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
          path === '/var' ? 'bg-emerald-600/20 text-emerald-400' : 'hover:bg-zinc-700 text-zinc-300'
        }`}
      >
        <Folder className="w-4 h-4 text-amber-400" />
        <span>/var</span>
      </button>
      <button
        onClick={() => { setPath('/tmp'); onSelect('/tmp'); }}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
          path === '/tmp' ? 'bg-emerald-600/20 text-emerald-400' : 'hover:bg-zinc-700 text-zinc-300'
        }`}
      >
        <Folder className="w-4 h-4 text-amber-400" />
        <span>/tmp</span>
      </button>
      <button
        onClick={() => { setPath('/usr'); onSelect('/usr'); }}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
          path === '/usr' ? 'bg-emerald-600/20 text-emerald-400' : 'hover:bg-zinc-700 text-zinc-300'
        }`}
      >
        <Folder className="w-4 h-4 text-amber-400" />
        <span>/usr</span>
      </button>
    </div>
  );
}
