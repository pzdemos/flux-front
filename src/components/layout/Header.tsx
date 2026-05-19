import { useAppStore } from '@/stores/app';
import { Bell } from 'lucide-react';

export default function Header() {
  const { notifications } = useAppStore();
  const unreadCount = notifications.filter((n) => n.type === 'error' || n.type === 'warning').length;

  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0 sticky top-0 z-20">
      <div className="flex items-center gap-3 pl-4">
        <h1 className="text-base font-semibold text-zinc-100">文件管理</h1>
      </div>

      <div className="flex items-center gap-2">
        <button className="relative p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
