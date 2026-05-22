import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import {
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
} from 'lucide-react';

const modules = [
  { id: 'files' as const, label: '文件管理', icon: FolderOpen },
];

export default function Sidebar() {
  const { activeModule, sidebarOpen, toggleSidebar, isMobile, setActiveModule, setViewMode } = useAppStore();
  const { user, logout } = useAuthStore();

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 backdrop-blur-sm"
          onClick={() => useAppStore.getState().setSidebarOpen(false)}
        />
      )}

      <aside
        className={`flex flex-col bg-zinc-900 border-r border-zinc-800 transition-all duration-300 z-40
          ${isMobile ? 'fixed inset-y-0 left-0' : 'relative'}
          ${sidebarOpen ? (isMobile ? 'w-64 translate-x-0' : 'w-56') : isMobile ? '-translate-x-full w-0' : 'w-0 overflow-hidden'}
        `}
      >
        {sidebarOpen && (
          <>
            {/* Logo */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white tracking-tight">Flux</span>
              </div>
              {!isMobile && (
                <button
                  onClick={toggleSidebar}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {modules.map((mod) => {
                const Icon = mod.icon;
                const isActive = activeModule === mod.id;
                return (
                  <button
                    key={mod.id}
                    onClick={() => {
                      setActiveModule(mod.id);
                      setViewMode('files');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-default
                      ${isActive
                        ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-600/20'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{mod.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* User & Actions */}
            <div className="border-t border-zinc-800 px-3 py-3 space-y-1">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                  <span className="text-xs font-medium text-zinc-300">
                    {user?.username?.charAt(0).toUpperCase() || 'A'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{user?.username || 'admin'}</p>
                  <p className="text-xs text-zinc-500">管理员</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveModule('tools');
                  setViewMode('tools');
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>设置</span>
              </button>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>退出</span>
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Collapsed toggle button */}
      {!sidebarOpen && !isMobile && (
        <button
          onClick={toggleSidebar}
          className="fixed left-0 top-4 z-40 p-2 rounded-r-lg bg-zinc-900 border border-l-0 border-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </>
  );
}
