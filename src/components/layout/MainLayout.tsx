import { useDeviceType } from '@/hooks/useDeviceType';
import Sidebar from './Sidebar';
import Header from './Header';
import FilesPage from '@/pages/Files';
import NotificationContainer from '@/components/shared/NotificationContainer';

export default function MainLayout() {
  useDeviceType();

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-hidden">
          <FilesPage />
        </main>
      </div>
      <NotificationContainer />
    </div>
  );
}
