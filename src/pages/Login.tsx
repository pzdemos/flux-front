import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { Terminal, Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react';
import { authApi } from '@/api/client';
import type { AxiosError } from 'axios';

export default function Login() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authApi.login(username, password);
      if (res.data.token) {
        login(res.data.token, username);
        window.location.href = '/#/';
        return;
      }
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: string; message?: string }>;
      if (axiosErr.response?.status === 401) {
        setError('用户名或密码错误');
      } else if (axiosErr.response?.data?.error || axiosErr.response?.data?.message) {
        setError(axiosErr.response.data.error || axiosErr.response.data.message || '请求失败');
      } else {
        setError(`请求失败: ${axiosErr.message || '未知错误'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-emerald-600 mb-4">
            <Terminal className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Flux</h1>
          <p className="text-zinc-400 text-sm">服务器文件管理系统</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-4">登录</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                placeholder="admin"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500
                    focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                  placeholder="请输入密码"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium
                disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
