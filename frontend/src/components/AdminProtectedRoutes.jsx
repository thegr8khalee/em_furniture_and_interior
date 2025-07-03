// src/components/Admin/AdminProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore'; // Import Zustand store

const AdminProtectedRoute = () => {
  const { authUser, isLoading, isAdmin } = useAuthStore(); // Access state from Zustand store

//   console.log('AdminProtectedRoute: authUser:', authUser); // DEBUG
//   console.log('AdminProtectedRoute: isAdmin:', isAdmin); // DEBUG
//   console.log('AdminProtectedRoute: isLoading:', isLoading); // DEBUG

  if (isLoading) {
    // Show a loading indicator while authentication status is being determined
    return <div className="text-center p-4">Loading authentication...</div>;
  }

  // Conditional rendering logic:
  // If there's no authUser OR the authUser is not an admin, redirect them to the login page.
  if (!authUser || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // If the authUser is logged in AND is an admin, render the nested routes (children of this Route element).
  return <Outlet />;
};

export default AdminProtectedRoute;
