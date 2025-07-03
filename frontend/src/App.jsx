// src/App.jsx
import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
// ... other imports
import AdminProtectedRoute from './components/AdminProtectedRoutes';
import { useAuthStore } from './store/useAuthStore'; // Import Zustand store
import AdminLoginPage from './pages/AdminLoginPage';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import AdminLoginProtectedRoute from './components/AdminLoginProtectedRoute';
import { useProductsStore } from './store/useProductsStore';
import { useCollectionStore } from './store/useCollectionStore';
import AdminAddProductPage from './pages/AddProductPage';
import AdminEditProductPage from './pages/EditProductPage';
import AddCollection from './pages/AddCollection';
import EditCollection from './pages/EditCollection';
import { Toaster } from 'react-hot-toast';

function App() {
  const { authUser, checkAuth } = useAuthStore();
  const { getProducts } = useProductsStore();
  const { getCollections } = useCollectionStore();
  // Initialize auth state when the component mounts
  useEffect(() => {
    checkAuth();
    getProducts();
    getCollections();
  }, [checkAuth, getProducts, getCollections]); // Dependency array ensures it runs once on mount

  console.log('AuthUser', authUser);
  // console.log('Products', products);
  // console.log('Collections', collections);
  return (
    <div className="max-h-screen">
      <Navbar />
      <main className="">
        <Routes>
          {/* Public product/collection/cart/wishlist routes */}
          {/* ... */}

          <Route path="/" element={authUser ? <HomePage /> : <LoginPage />} />

          <Route element={<AdminLoginProtectedRoute />}>
            <Route path="/admin/login" element={<AdminLoginPage />} />
          </Route>
          {/* Admin Protected Routes */}
          {/* This is how you conditionally render based on admin status */}
          <Route element={<AdminProtectedRoute />}>
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route
              path="/admin/products/new"
              element={<AdminAddProductPage />}
            />
            <Route path="/admin/products/edit/:productId" element={<AdminEditProductPage />} />
            <Route
              path="/admin/collections/new"
              element={<AddCollection />}
            />
            <Route path="/admin/collections/edit/:collectionId" element={<EditCollection />} />
          </Route>

          <Route path="*" element={<div>404 Not Found</div>} />
         
        </Routes> <Toaster/>
      </main>
      {/* ... other layout components */}
    </div>
  );
}

export default App;
