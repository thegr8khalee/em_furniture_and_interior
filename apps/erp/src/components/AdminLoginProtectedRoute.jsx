import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@em/domain';

// A customer who lands on the console belongs on the storefront, which is now a
// different origin — so this is a location change, not a route change.
const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:5173';

const AdminLoginProtectedRoute = () => {
  const { authUser, isCheckingAuth, isAdmin, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isCheckingAuth && authUser && !isAdmin) {
      window.location.replace(STOREFRONT_URL);
    }
  }, [isCheckingAuth, authUser, isAdmin]);

  if (isCheckingAuth) {
    return <div className="text-center p-4">Loading authentication...</div>;
  }

  if (authUser && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (authUser && !isAdmin) {
    // The effect above is sending them to the storefront; render nothing rather
    // than flashing the sign-in form at a customer.
    return null;
  }

  return <Outlet />;
};

export default AdminLoginProtectedRoute;
