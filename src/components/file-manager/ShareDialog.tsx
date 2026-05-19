import { useState } from 'react';
import { shareApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { X, Share2, Copy, Loader2, Lock, Check } from 'lucide-react';
import type { ShareCreateResponse } from '@/types';

interface ShareDialogProps {
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export default function ShareDialog({ filePath, fileName, onClose }: ShareDialogProps) {
  const [expiresIn, setExpiresIn] = useState('86400');
  const [password, setPassword] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('0');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShareCreateResponse | null>(null);
  const addNotification = useAppStore((s) => s.addNotification);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await shareApi.create(
        filePath,
        parseInt(expiresIn),
        password || undefined,
        parseInt(maxDownloads) || undefined
      );
      setResult(res.data);
      addNotification({ type: 'success', message: '分享链接已创建' });
    } catch {
      addNotification({ type: 'error', message: '创建分享失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.shareUrl);
    addNotification({ type: 'success', message: '链接已复制' });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-emerald-400" />
            分享文件
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-sm text-zinc-400 mb-4 truncate">{fileName}</p>

        {!result ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">有效期</label>
              <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white outline-none">
                <option value="3600">1 小时</option>
                <option value="86400">1 天</option>
                <option value="604800">7 天</option>
                <option value="2592000">30 天</option>
                <option value="0">永久</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">访问密码（可选）</label>
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="留空表示无需密码"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">最大下载次数（0=不限）</label>
              <input type="number" value={maxDownloads} onChange={(e) => setMaxDownloads(e.target.value)} min="0"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white outline-none focus:border-emerald-500" />
            </div>
            <button onClick={handleCreate} disabled={loading}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              创建分享
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <p className="text-xs text-emerald-400 mb-1 flex items-center gap-1"><Check className="w-3 h-3" />分享创建成功</p>
              <p className="text-xs text-zinc-400">过期: {result.expiresAt}</p>
            </div>
            <div className="p-3 bg-zinc-800 rounded-lg">
              <p className="text-xs text-zinc-500 mb-1">分享链接</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-emerald-400 font-mono break-all">{result.shareUrl}</code>
                <button onClick={handleCopy} className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white shrink-0"><Copy className="w-4 h-4" /></button>
              </div>
            </div>
            {result.password && (
              <p className="text-xs text-amber-400 flex items-center gap-1"><Lock className="w-3 h-3" />此分享已设置密码</p>
            )}
            <button onClick={onClose} className="w-full py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm transition-colors">
              完成
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
