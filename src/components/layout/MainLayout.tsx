import { useDeviceType } from '@/hooks/useDeviceType';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import FilesPage from '@/pages/Files';
import TerminalPage from '@/pages/Terminal';
import DnsPage from '@/pages/Dns';
import EcsInstancesPage from '@/pages/EcsInstances';
import EcsSecurityGroupsPage from '@/pages/EcsSecurityGroups';
import EcsDisksPage from '@/pages/EcsDisks';
import NotificationContainer from '@/components/shared/NotificationContainer';
import { useAppStore } from '@/stores/app';

const MODULE_ROUTES: Record<string, React.ComponentType<{ visible?: boolean }>> = {
  files: FilesPage,
  terminal: TerminalPage,
  dns: DnsPage,
  ecs: EcsInstancesPage,
  sg: EcsSecurityGroupsPage,
  disk: EcsDisksPage,
};

export default function MainLayout() {
  useDeviceType();
  const location = useLocation();
  const setActiveModule = useAppStore((s) => s.setActiveModule);

  useEffect(() => {
    const path = location.pathname.split('/')[1] || 'files';
    if (MODULE_ROUTES[path]) {
      setActiveModule(path);
    }
  }, [location.pathname, setActiveModule]);

  const activeModule = useAppStore((s) => s.activeModule);
  const ActivePage = MODULE_ROUTES[activeModule] || FilesPage;

  return (
    <div className="flex h-[100vh] h-[100dvh] bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0">
            <ActivePage visible={activeModule === 'terminal'} />
          </div>
        </main>
      </div>
      <NotificationContainer />
    </div>
  );
}
