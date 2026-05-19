import { useState, useEffect, useCallback } from 'react';
import { shareApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { Share2, Copy, Trash2, Loader2, Clock, Lock, Eye } from 'lucide-react';
import type { ShareItem } from '@/types';

export default function ShareView() {
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(false);
  const addNotification = useAppStore((s) => s.addNotification);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shareApi.list();
      // Ensure shares is always an array
      const data = res.data;
      if (Array.isArray(data)) {
        setShares(data);
      } else if (data && typeof data === 'object' && 'items' in data && Array.isArray(data.items)) {
        setShares(data.items);
      } else if (data && typeof data === 'object' && 'shares' in data && Array.isArray(data.shares)) {
        setShares(data.shares);
      } else {
        console.warn('[ShareView] Unexpected data format:', data);
        setShares([]);
      }
    } catch (err) {
      console.error('[ShareView] Load error:', err);
      addNotification({ type: 'error', message: '获取分享列表失败' });
      setShares([]);
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (token: string) => {
    const c = window.confirm('确定要删除此分享链接？');
    if (!c) return;
    try {
      await shareApi.delete(token);
      addNotification({ type: 'success', message: '分享已删除' });
      load();
    } catch {
      addNotification({ type: 'error', message: '删除失败' });
    }
  };

  const handleCopy = async (shareToken: string) => {
    // Use friendly share URL format
    const friendlyUrl = `${window.location.origin}/#/share/${shareToken}`;
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(friendlyUrl);
        addNotification({ type: 'success', message: '分享链接已复制' });
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = friendlyUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          addNotification({ type: 'success', message: '分享链接已复制' });
        } catch (err) {
          throw err;
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (err) {
      console.error('[ShareView] Copy failed:', err);
      addNotification({ type: 'error', message: '复制失败，请手动复制' });
      // Show the URL in a prompt as last resort
      window.prompt('请手动复制分享链接:', friendlyUrl);
    }
  };

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Share2 className="w-5 h-5 text-emerald-400" />
          文件分享
          <span className="text-sm text-zinc-500 font-normal">({shares.length})</span>
        </h2>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : shares.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center">
            <Share2 className="w-16 h-16 mx-auto mb-3 text-zinc-600" />
            <p className="text-zinc-400 text-base">暂无分享</p>
            <p className="text-zinc-500 text-sm mt-1">右键点击文件可创建分享链接</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-2">
          {shares.map((share) => (
            <div key={share.id} className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800/50 transition-colors">
              <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                {share.has_password ? <Lock className="w-4 h-4 text-emerald-400" /> : <Eye className="w-4 h-4 text-emerald-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 truncate">{share.filename}</p>
                <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{share.expired ? '已过期' : share.expires_at}</span>
                  <span>下载 {share.download_count}{share.max_downloads > 0 ? `/${share.max_downloads}` : ''}</span>
                </div>
              </div>
              <button onClick={() => handleCopy(share.share_token)} className="p-2 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors" title="复制链接">
                <Copy className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(share.share_token)} className="p-2 rounded hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors" title="删除">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
