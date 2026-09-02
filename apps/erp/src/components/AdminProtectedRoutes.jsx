import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@em/domain';

/**
 * Gate on the console's routes.
 *
 * Redirects to the console's own login screen, not to "/". The console is now a
 * separate deployment whose "/" is a catch-all back to the dashboard, so
 * sending an unauthenticated visitor there would bounce them between the two
 * forever.
 */
const AdminProtectedRoute = () => {
  const { authUser, isCheckingAuth, isAdmin } = useAuthStore();

  if (isCheckingAuth) {
    return <div className="text-center p-4">Loading authentication...</div>;
  }

  if (!authUser || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
};

export default AdminProtectedRoute;
