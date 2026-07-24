import { Routes, Route, Navigate, HashRouter } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import MainLayout from '@/components/layout/MainLayout';
import Login from '@/pages/Login';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="files" replace />} />
          <Route path="files" element={null} />
          <Route path="terminal" element={null} />
          <Route path="dns" element={null} />
          <Route path="ecs" element={null} />
          <Route path="sg" element={null} />
          <Route path="disk" element={null} />
          <Route path="nginx" element={null} />
          <Route path="*" element={<Navigate to="files" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
