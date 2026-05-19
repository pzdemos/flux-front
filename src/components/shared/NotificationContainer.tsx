import { useAppStore } from '@/stores/app';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  success: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10',
  error: 'text-red-500 border-red-500/20 bg-red-500/10',
  warning: 'text-amber-500 border-amber-500/20 bg-amber-500/10',
  info: 'text-sky-500 border-sky-500/20 bg-sky-500/10',
};

export default function NotificationContainer() {
  const notifications = useAppStore((s) => s.notifications);
  const remove = useAppStore((s) => s.removeNotification);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-md">
      {notifications.map((n) => {
        const Icon = icons[n.type];
        return (
          <div
            key={n.id}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm ${colors[n.type]}`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-sm text-zinc-100 flex-1">{n.message}</span>
            <button
              onClick={() => remove(n.id)}
              className="shrink-0 rounded p-1 hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
