import { useState } from 'react';
import { compressApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { X, FileArchive, Loader2 } from 'lucide-react';

interface ExtractDialogProps {
  filePath: string;
  fileName: string;
  currentPath: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ExtractDialog({ filePath, fileName, currentPath, onClose, onSuccess }: ExtractDialogProps) {
  const [outputDir, setOutputDir] = useState('');
  const [loading, setLoading] = useState(false);
  const addNotification = useAppStore((s) => s.addNotification);

  const isZip = fileName.endsWith('.zip');
  const isTar = fileName.endsWith('.tar') || fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz');

  const handleExtract = async () => {
    const outDir = outputDir || currentPath;
    setLoading(true);
    try {
      if (isZip) {
        await compressApi.extractZip(filePath, outDir);
      } else if (isTar) {
        await compressApi.extractTar(filePath, outDir);
      } else {
        addNotification({ type: 'error', message: '不支持的压缩格式' });
        return;
      }
      addNotification({ type: 'success', message: '解压完成' });
      onSuccess();
      onClose();
    } catch {
      addNotification({ type: 'error', message: '解压失败' });
    } finally {
      setLoading(false);
    }
  };

  if (!isZip && !isTar) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <p className="text-zinc-300">不支持此文件格式的解压</p>
          <button onClick={onClose} className="mt-3 w-full py-2 rounded-lg bg-zinc-700 text-white text-sm">关闭</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2"><FileArchive className="w-5 h-5 text-emerald-400" />解压</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-zinc-400 mb-3 truncate">{fileName}</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">解压到目录（留空为当前目录）</label>
            <input value={outputDir} onChange={(e) => setOutputDir(e.target.value)} placeholder={currentPath}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white outline-none focus:border-emerald-500" autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleExtract()} />
          </div>
          <button onClick={handleExtract} disabled={loading}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
            解压
          </button>
        </div>
      </div>
    </div>
  );
}
