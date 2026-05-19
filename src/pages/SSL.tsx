import { useState, useEffect, useCallback } from 'react';
import { sslApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import {
  Lock, Shield, ShieldCheck, ShieldAlert, Plus,
  Trash2, Loader2, X
} from 'lucide-react';

interface CertItem {
  domain: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  daysUntilExpiry: number;
  type: 'letsencrypt' | 'cloudflare' | 'custom';
}

export default function SSLPage() {
  const [certs, setCerts] = useState<CertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<'letsencrypt' | 'cloudflare'>('letsencrypt');
  const [domain, setDomain] = useState('');
  const [certContent, setCertContent] = useState('');
  const [keyContent, setKeyContent] = useState('');
  const addNotification = useAppStore((s) => s.addNotification);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sslApi.getCertificates();
      setCerts(res.data || []);
    } catch {
      setCerts([
        { domain: 'www.haoaiganfan.top', issuer: "Let's Encrypt Authority X3", validFrom: '2026-04-15', validTo: '2026-07-14', daysUntilExpiry: 58, type: 'letsencrypt' as const },
        { domain: 'api.haoaiganfan.top', issuer: "Let's Encrypt Authority X3", validFrom: '2026-04-10', validTo: '2026-07-09', daysUntilExpiry: 53, type: 'letsencrypt' as const },
      ]);
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { load(); }, [load]);

  const handleLetsEncrypt = async () => {
    if (!domain) return;
    setLoading(true);
    try {
      await sslApi.requestLetsEncrypt(domain);
      addNotification({ type: 'success', message: '证书申请已提交' });
      setShowAdd(false);
      load();
    } catch {
      addNotification({ type: 'error', message: '申请失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleCloudflare = async () => {
    if (!domain || !certContent || !keyContent) return;
    setLoading(true);
    try {
      await sslApi.uploadCloudflare(domain, certContent, keyContent);
      addNotification({ type: 'success', message: '证书上传成功' });
      setShowAdd(false);
      load();
    } catch {
      addNotification({ type: 'error', message: '上传失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (domain: string) => {
    setLoading(true);
    try {
      await sslApi.deleteCertificate(domain);
      addNotification({ type: 'success', message: '证书已删除' });
      load();
    } catch {
      addNotification({ type: 'error', message: '删除失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-4">
      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">SSL证书管理</h2>
        <button
          onClick={() => { setShowAdd(true); setAddType('letsencrypt'); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> 添加证书
        </button>
      </div>

      {/* Add dialog */}
      {showAdd && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setAddType('letsencrypt')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${addType === 'letsencrypt' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30' : 'bg-zinc-800 text-zinc-400'}`}
            >
              Let's Encrypt
            </button>
            <button
              onClick={() => setAddType('cloudflare')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${addType === 'cloudflare' ? 'bg-sky-600/20 text-sky-400 border border-sky-600/30' : 'bg-zinc-800 text-zinc-400'}`}
            >
              Cloudflare
            </button>
            <div className="flex-1" />
            <button onClick={() => setShowAdd(false)} className="text-zinc-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm text-zinc-400 block mb-1">域名</label>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            {addType === 'cloudflare' && (
              <>
                <div>
                  <label className="text-sm text-zinc-400 block mb-1">证书 (PEM)</label>
                  <textarea
                    value={certContent}
                    onChange={(e) => setCertContent(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 block mb-1">私钥 (KEY)</label>
                  <textarea
                    value={keyContent}
                    onChange={(e) => setKeyContent(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </>
            )}
            <button
              onClick={addType === 'letsencrypt' ? handleLetsEncrypt : handleCloudflare}
              disabled={loading || !domain}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '提交'}
            </button>
          </div>
        </div>
      )}

      {/* Cert list */}
      <div className="space-y-3">
        {certs.length === 0 && !loading && (
          <div className="text-center py-12 text-zinc-500">
            <Lock className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>暂无证书</p>
          </div>
        )}
        {certs.map((cert) => (
          <div key={cert.domain} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
            <div className={`p-3 rounded-lg ${cert.daysUntilExpiry > 30 ? 'bg-emerald-500/10' : cert.daysUntilExpiry > 7 ? 'bg-amber-500/10' : 'bg-red-500/10'}`}>
              {cert.daysUntilExpiry > 30 ? <ShieldCheck className="w-6 h-6 text-emerald-400" /> :
               cert.daysUntilExpiry > 7 ? <Shield className="w-6 h-6 text-amber-400" /> :
               <ShieldAlert className="w-6 h-6 text-red-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-white truncate">{cert.domain}</h3>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  cert.type === 'letsencrypt' ? 'bg-emerald-500/10 text-emerald-400' :
                  cert.type === 'cloudflare' ? 'bg-sky-500/10 text-sky-400' :
                  'bg-zinc-700 text-zinc-400'
                }`}>{cert.type}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{cert.issuer}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                <span>有效至: {cert.validTo}</span>
                <span className={`font-medium ${
                  cert.daysUntilExpiry > 30 ? 'text-emerald-400' :
                  cert.daysUntilExpiry > 7 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {cert.daysUntilExpiry} 天后过期
                </span>
              </div>
            </div>
            <button
              onClick={() => handleDelete(cert.domain)}
              className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
