import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';

/** Защищает маршрут: требует входа, опционально — роль ADMIN. */
export default function ProtectedRoute({
  children,
  role,
}: {
  children: ReactNode;
  role?: 'ADMIN' | 'CASHIER';
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-gray-900 text-gray-500 flex items-center justify-center">…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;

  return <>{children}</>;
}
