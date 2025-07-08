// src/App.jsx
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
import BottomNavbar from './components/BottomNavbar';
import Footer from './components/Footer';
import whatsapp from '../src/images/whatsapp_4401461.png';
import Shop from './pages/Shop';
import AdminSidebar from './components/admin/AdminSideBar';
import ProductPage from './pages/ProductPage';
import CollectionDetailsPage from './pages/CollectionDetailPage';
import Styles from './pages/Styles';
import SignupPage from './pages/Signup';
import ProfilePage from './pages/Profile';
import CartPage from './pages/Cart';
import WishlistPage from './pages/Wishlist';
import AboutUs from './pages/AboutUs';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Contact from './pages/Contact';

function App() {
  const { checkAuth, authUser, isAdmin } = useAuthStore();
  const { getProducts } = useProductsStore();
  const { getCollections } = useCollectionStore();
  // Initialize auth state when the component mounts
  useEffect(() => {
    checkAuth();
    getProducts();
    getCollections();
  }, [checkAuth, getProducts, getCollections]); // Dependency array ensures it runs once on mount

  // console.log('AuthUser', authUser);
  // console.log('Products', products);
  // console.log('Collections', collections);
  return (
    <div className="max-h-screen">
      <Navbar />
      <BottomNavbar />
      <main className="">
        <Routes>
          {/* Public product/collection/cart/wishlist routes */}
          {/* ... */}
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/styles/:style" element={<Styles />} />
          <Route path="/product/:productId" element={<ProductPage />} />
          <Route
            path="/collection/:collectionId"
            element={<CollectionDetailsPage />}
          />
          <Route
            path="/profile"
            element={
              isAdmin ? (
                <Navigate to="/admin/dashboard" />
              ) : authUser ? (
                <ProfilePage />
              ) : (
                <LoginPage />
              )
            }
          />

          <Route path="/signup" element={<SignupPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/aboutUs" element={<AboutUs />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/contact" element={<Contact />} />

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
            <Route
              path="/admin/products/edit/:productId"
              element={<AdminEditProductPage />}
            />
            <Route path="/admin/collections/new" element={<AddCollection />} />
            <Route
              path="/admin/collections/edit/:collectionId"
              element={<EditCollection />}
            />
          </Route>

          <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>{' '}
      </main>
      <Footer />
      <button className="bg-none size-20 border-none fixed bottom-25 lg:bottom-6 right-6 rounded-full shadow-lg transition-colors duration-200 z-40 flex items-center justify-center">
        <img src={whatsapp} alt="" className="" />
      </button>
      <Toaster />
      {/* ... other layout components */}
    </div>
  );
}

export default App;
