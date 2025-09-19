import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DrivePage } from './pages/DrivePage';
import { TrashPage } from './pages/TrashPage';
import { SharedPage } from './pages/SharedPage';
import { Skeleton } from './components/ui/Skeleton';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-light dark:bg-surface-dark">
        <Skeleton className="h-24 w-24 rounded-full" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/drive" replace />} />
        <Route path="drive" element={<DrivePage />} />
        <Route path="trash" element={<TrashPage />} />
        <Route path="shared" element={<SharedPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/drive" replace />} />
    </Routes>
  );
}
