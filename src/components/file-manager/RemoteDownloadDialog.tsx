import { useState } from 'react';
import { downloadApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { X, Download, Link, Loader2 } from 'lucide-react';

interface Props {
  currentPath: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RemoteDownloadDialog({ currentPath, onClose, onSuccess }: Props) {
  const [url, setUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [loading, setLoading] = useState(false);
  const addNotification = useAppStore((s) => s.addNotification);

  const handleDownload = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const name = filename || url.split('/').pop() || 'download';
      await downloadApi.remoteDownload(url, name, currentPath);
      addNotification({ type: 'success', message: `远程下载已开始: ${name}` });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      addNotification({ type: 'error', message: `远程下载失败: ${msg}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-semibold text-white">远程下载</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-zinc-400 mb-4">
          从远程 URL 下载文件到当前目录: <code className="text-emerald-400">{currentPath}</code>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">下载链接</label>
            <div className="relative">
              <Link className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/file.zip"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">保存文件名（可选）</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="自动从 URL 提取"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors">
            取消
          </button>
          <button
            onClick={handleDownload}
            disabled={!url || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {loading ? '下载中...' : '开始下载'}
          </button>
        </div>
      </div>
    </div>
  );
}
