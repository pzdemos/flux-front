import { useSearchParams, Navigate } from 'react-router-dom';
import { useDeviceType } from '@/hooks/useDeviceType';
import CodeWorkspace from '@/components/ide/CodeWorkspace';

export default function IDE() {
  useDeviceType();
  const [params] = useSearchParams();
  const path = params.get('path') || '';

  if (!path) return <Navigate to="/files" replace />;

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-950">
      <CodeWorkspace path={path} />
    </div>
  );
}
