import { useAppStore } from '@/stores/app';
import { X, Bell, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const TYPE_CONFIG = {
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  success: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  info: { icon: Info, color: 'text-sky-400', bg: 'bg-sky-500/10' },
};

export default function NotificationPanel({ onClose }: Props) {
  const { notifications, removeNotification } = useAppStore();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-14 right-4 z-50 w-80 max-h-[70vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-medium text-white">通知</span>
            {notifications.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-emerald-500/20 text-emerald-400">
                {notifications.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Bell className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">暂无通知</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {notifications.map((n) => {
                const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                const Icon = config.icon;
                return (
                  <div key={n.id} className={`flex items-start gap-3 px-4 py-3 ${config.bg} hover:bg-white/5 transition-colors`}>
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 break-words">{n.message}</p>
                    </div>
                    <button
                      onClick={() => removeNotification(n.id)}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t border-zinc-800">
            <button
              onClick={() => notifications.forEach((n) => removeNotification(n.id))}
              className="w-full text-xs text-zinc-500 hover:text-white transition-colors"
            >
              清除全部
            </button>
          </div>
        )}
      </div>
    </>
  );
}
