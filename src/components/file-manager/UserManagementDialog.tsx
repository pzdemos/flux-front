import { useState } from 'react';
import { authApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { X, UserPlus, KeyRound, Loader2 } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function UserManagementDialog({ onClose }: Props) {
  const [tab, setTab] = useState<'register' | 'password'>('register');
  const [username, setUsername] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const addNotification = useAppStore((s) => s.addNotification);

  const handleRegister = async () => {
    if (!username || !newPassword) return;
    setLoading(true);
    try {
      await authApi.register(username, newPassword);
      addNotification({ type: 'success', message: `用户 ${username} 注册成功` });
      setUsername('');
      setNewPassword('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      addNotification({ type: 'error', message: `注册失败: ${msg}` });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) return;
    setLoading(true);
    try {
      await authApi.changePassword(oldPassword, newPassword);
      addNotification({ type: 'success', message: '密码修改成功' });
      setOldPassword('');
      setNewPassword('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      addNotification({ type: 'error', message: `修改密码失败: ${msg}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">用户管理</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-zinc-800/50 rounded-lg p-1">
          <button
            onClick={() => setTab('register')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'register' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            注册用户
          </button>
          <button
            onClick={() => setTab('password')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'password' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            修改密码
          </button>
        </div>

        {tab === 'register' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="输入用户名"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="输入密码"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500"
              />
            </div>
            <button
              onClick={handleRegister}
              disabled={!username || !newPassword || loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {loading ? '注册中...' : '注册'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">当前密码</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="输入当前密码"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="输入新密码"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500"
              />
            </div>
            <button
              onClick={handleChangePassword}
              disabled={!oldPassword || !newPassword || loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {loading ? '修改中...' : '修改密码'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
