import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuthStore } from '@em/domain';

const AdminLoginProtectedRoute = () => {
  const { adminUser, isCheckingAdminAuth, checkAdminAuth } = useAdminAuthStore();

  useEffect(() => {
    checkAdminAuth();
  }, [checkAdminAuth]);

  if (isCheckingAdminAuth) {
    return <div className="text-center p-4">Loading authentication...</div>;
  }

  if (adminUser) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
};

export default AdminLoginProtectedRoute;
