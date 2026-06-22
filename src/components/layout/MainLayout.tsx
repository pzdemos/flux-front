import { useDeviceType } from '@/hooks/useDeviceType';
import Sidebar from './Sidebar';
import Header from './Header';
import FilesPage from '@/pages/Files';
import TerminalPage from '@/pages/Terminal';
import NotificationContainer from '@/components/shared/NotificationContainer';
import { useAppStore } from '@/stores/app';

export default function MainLayout() {
  useDeviceType();
  const activeModule = useAppStore((s) => s.activeModule);

  return (
    <div className="flex h-[100vh] h-[100dvh] bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-hidden relative">
          <div className={`absolute inset-0 ${activeModule === 'terminal' ? '' : 'hidden'}`}>
            <TerminalPage visible={activeModule === 'terminal'} />
          </div>
          <div className={`absolute inset-0 ${activeModule === 'files' ? '' : 'hidden'}`}>
            <FilesPage />
          </div>
        </main>
      </div>
      <NotificationContainer />
    </div>
  );
}
