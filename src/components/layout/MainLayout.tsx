import { useDeviceType } from '@/hooks/useDeviceType';
import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import FilesPage from '@/pages/Files';
import TerminalPage from '@/pages/Terminal';
import DnsPage from '@/pages/Dns';
import EcsInstancesPage from '@/pages/EcsInstances';
import EcsSecurityGroupsPage from '@/pages/EcsSecurityGroups';
import EcsDisksPage from '@/pages/EcsDisks';
import NginxPage from '@/pages/Nginx';
import NotificationContainer from '@/components/shared/NotificationContainer';
import { useAppStore } from '@/stores/app';

const MODULE_ROUTES: Record<string, React.ComponentType<{ visible?: boolean }>> = {
  files: FilesPage,
  terminal: TerminalPage,
  dns: DnsPage,
  ecs: EcsInstancesPage,
  sg: EcsSecurityGroupsPage,
  disk: EcsDisksPage,
  nginx: NginxPage,
};

export default function MainLayout() {
  useDeviceType();
  const location = useLocation();
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const activeModule = useAppStore((s) => s.activeModule);
  // 已访问模块保持挂载（hidden 切换），避免切走终端时销毁 WS / xterm scrollback
  const [mountedModules, setMountedModules] = useState<Set<string>>(() => new Set(['files']));

  useEffect(() => {
    const path = location.pathname.split('/')[1] || 'files';
    if (MODULE_ROUTES[path]) {
      setActiveModule(path);
    }
  }, [location.pathname, setActiveModule]);

  useEffect(() => {
    const key = MODULE_ROUTES[activeModule] ? activeModule : 'files';
    setMountedModules((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, [activeModule]);

  return (
    <div className="flex h-[100vh] h-[100dvh] bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-hidden relative">
          {Object.entries(MODULE_ROUTES).map(([key, Page]) => {
            if (!mountedModules.has(key)) return null;
            const isActive = activeModule === key || (!MODULE_ROUTES[activeModule] && key === 'files');
            return (
              <div
                key={key}
                className={isActive ? 'absolute inset-0' : 'hidden'}
                aria-hidden={!isActive}
              >
                <Page visible={isActive} />
              </div>
            );
          })}
        </main>
      </div>
      <NotificationContainer />
    </div>
  );
}
