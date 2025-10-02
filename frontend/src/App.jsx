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
// import whatsapp from '../src/images/whatsapp_4401461.png';
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
import ECatalog from './pages/ECatalog';
import Showroom from './pages/Showroom';
import CookieConsentBanner from './components/CookieConsentBanner';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AdminAddProjectPage from './pages/AddProject';
import AdminEditProjectPage from './pages/EditProject';
import Projects from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';

function App() {
  const { checkAuth, authUser, isAdmin, isAuthReady } = useAuthStore();
  const { getProducts } = useProductsStore();
  const { getCollections } = useCollectionStore();
  // Initialize auth state when the component mounts
  useEffect(() => {
    checkAuth();
    getProducts();
    getCollections();
  }, [checkAuth, getProducts, getCollections]); // Dependency array ensures it runs once on mount

  const whatsappPhoneNumber = '2349037691860'; // REPLACE WITH YOUR ACTUAL PHONE NUMBER
  // Your preset message (URL-encoded)
  const presetMessage = encodeURIComponent(
    "Hello, I'm interested in your products. I saw your website and would like to inquire more."
  );

  const whatsappLink = `https://wa.me/${whatsappPhoneNumber}?text=${presetMessage}`;

  console.log('AuthUser', authUser);
  // console.log('Products', products);
  // console.log('Collections', collections);
  return (
    <div className="max-h-screen">
      <Navbar />
      <BottomNavbar />
      {/* {!authUser && 
        <CookieConsentBanner/>
      } */}
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

          <Route
            path="/signup"
            element={!authUser ? <SignupPage /> : <LoginPage />}
          />
          <Route path='/projects' element={<Projects />} />
          <Route path='/project/:id' element={<ProjectDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/aboutUs" element={<AboutUs />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/e-catalog" element={<ECatalog />} />
          <Route path="/showroom" element={<Showroom />} />
          <Route
            path="/reset-password/:token"
            element={<ResetPasswordPage />}
          />

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
            <Route path="/admin/addProject" element={<AdminAddProjectPage />} />
            <Route path='/admin/editProject/:projectId' element={<AdminEditProjectPage />}/>
          </Route>

          <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>{' '}
      </main>
      <Footer />
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-none size-20 border-none fixed bottom-25 lg:bottom-6 right-6 rounded-full shadow-lg transition-colors duration-200 z-40 flex items-center justify-center"
        aria-label="Chat on WhatsApp"
      >
        <img
          src={
            'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/whatsapp_4401461_vssasq.png'
          }
          alt="WhatsApp Chat"
          className="w-full h-full object-contain"
        />
      </a>
      {!authUser && isAuthReady && <CookieConsentBanner />}
      <Toaster />
      {/* ... other layout components */}
    </div>
  );
}

export default App;
