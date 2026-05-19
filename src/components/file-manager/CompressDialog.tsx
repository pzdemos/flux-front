import { useState } from 'react';
import { compressApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { X, FileArchive, Loader2 } from 'lucide-react';

interface CompressDialogProps {
  selectedPaths: string[];
  currentPath?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CompressDialog({ selectedPaths, onClose, onSuccess }: CompressDialogProps) {
  const [format, setFormat] = useState<'zip' | 'tar'>('zip');
  const [outputName, setOutputName] = useState('archive');
  const [loading, setLoading] = useState(false);
  const addNotification = useAppStore((s) => s.addNotification);

  const handleCompress = async () => {
    if (!outputName) return;
    const ext = format === 'zip' ? '.zip' : '.tar.gz';
    const filename = outputName.endsWith(ext) ? outputName : outputName + ext;
    setLoading(true);
    try {
      if (format === 'zip') {
        await compressApi.zip(selectedPaths, filename);
      } else {
        await compressApi.tar(selectedPaths, filename);
      }
      addNotification({ type: 'success', message: `压缩完成: ${filename}` });
      onSuccess();
      onClose();
    } catch {
      addNotification({ type: 'error', message: '压缩失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2"><FileArchive className="w-5 h-5 text-amber-400" />压缩</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-zinc-400 mb-3">已选择 {selectedPaths.length} 个项目</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">格式</label>
            <div className="flex gap-2">
              <button onClick={() => setFormat('zip')} className={`flex-1 py-2 rounded-lg text-sm ${format === 'zip' ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>ZIP</button>
              <button onClick={() => setFormat('tar')} className={`flex-1 py-2 rounded-lg text-sm ${format === 'tar' ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>TAR.GZ</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">文件名</label>
            <input value={outputName} onChange={(e) => setOutputName(e.target.value)} placeholder="archive"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white outline-none focus:border-amber-500" autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCompress()} />
          </div>
          <button onClick={handleCompress} disabled={loading || !outputName}
            className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
            压缩
          </button>
        </div>
      </div>
    </div>
  );
}
