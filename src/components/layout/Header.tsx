import { useState } from 'react';
import { useAppStore } from '@/stores/app';
import { Bell, Menu } from 'lucide-react';
import ServerStatus from '@/components/shared/ServerStatus';
import NotificationPanel from '@/components/file-manager/NotificationPanel';

const MODULE_TITLES: Record<string, string> = {
  files: '文件管理',
  terminal: '终端管理',
  dns: 'DNS解析',
  ecs: 'ECS实例',
  sg: '安全组',
  disk: '云盘',
  nginx: 'Nginx',
};

export default function Header() {
  const { notifications, isMobile, toggleSidebar, activeModule } = useAppStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter((n) => n.type === 'error' || n.type === 'warning').length;
  const moduleTitle = MODULE_TITLES[activeModule] || '文件管理';

  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {isMobile && (
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-base font-semibold text-zinc-100">{moduleTitle}</h1>
      </div>

      <div className="flex items-center gap-1.5">
        <ServerStatus />
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {showNotifications && (
        <NotificationPanel onClose={() => setShowNotifications(false)} />
      )}
    </header>
  );
}
