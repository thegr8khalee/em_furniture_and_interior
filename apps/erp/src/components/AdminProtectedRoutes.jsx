import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuthStore } from '@em/domain';

/**
 * Gate on the console's routes.
 *
 * Redirects to the console's own login screen, not to "/". The console is now a
 * separate deployment whose "/" is a catch-all back to the dashboard, so
 * sending an unauthenticated visitor there would bounce them between the two
 * forever.
 */
const AdminProtectedRoute = () => {
  const { adminUser, isCheckingAdminAuth } = useAdminAuthStore();

  if (isCheckingAdminAuth) {
    return <div className="text-center p-4">Loading authentication...</div>;
  }

  if (!adminUser) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
};

export default AdminProtectedRoute;
