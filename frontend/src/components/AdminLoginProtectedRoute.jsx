// src/components/Admin/AdminLoginProtectedRoute.jsx
import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

const AdminLoginProtectedRoute = () => {
    const { authUser, isLoading, isAdmin, checkAuth } = useAuthStore(); // Access state from Zustand store

    useEffect(() => {
        checkAuth();
      }, [checkAuth]);

    if (isLoading) {
        // Show a loading indicator while authentication status is being determined
        return <div className="text-center p-4">Loading authentication...</div>;
    }

    // Condition 1: If already logged in AND is an admin, redirect to admin dashboard.
    if (authUser && isAdmin) {
        return <Navigate to="/admin/dashboard" replace />;
    }

    // Condition 2: If logged in BUT NOT an admin (i.e., a regular user), redirect to the home page.
    if (authUser && !isAdmin) {
        return <Navigate to="/" replace />; // Redirect non-admin authenticated users to home
    }

    // Condition 3: If not logged in at all, allow access to the nested route (the AdminLoginPage).
    return <Outlet />;
};

export default AdminLoginProtectedRoute;
