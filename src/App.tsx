import { Routes, Route, Navigate, HashRouter } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import MainLayout from '@/components/layout/MainLayout';
import Login from '@/pages/Login';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      const stored = localStorage.getItem('flux_auth');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.token && parsed.user) {
            useAuthStore.getState().login(parsed.token, parsed.user.username);
          }
        } catch {
          /* invalid stored data */
        }
      }
    }
  }, []);

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
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </HashRouter>
  );
}
