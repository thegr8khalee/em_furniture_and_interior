// src/App.jsx
import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { luxuryEase } from './lib/animations';
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
import ProductPage from './pages/ProductPage';
import CompareProducts from './pages/CompareProducts';
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
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import FAQ from './pages/FAQ';
import Consultation from './pages/Consultation';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import PaymentVerify from './pages/PaymentVerify';
import OrderHistoryPage from './pages/OrderHistoryPage';
import CouponManagement from './pages/admin/CouponManagement';
import OrderManagement from './pages/admin/OrderManagement';
import TrackOrderPage from './pages/TrackOrderPage';
import NotificationsPage from './pages/NotificationsPage';
import LoyaltyPage from './pages/LoyaltyPage';
import ReviewModeration from './pages/admin/ReviewModeration';
import ConsultationManagement from './pages/admin/ConsultationManagement';
import DesignerManagement from './pages/admin/DesignerManagement';
import MarketingManagement from './pages/admin/MarketingManagement';
import InventoryManagement from './pages/admin/InventoryManagement';
import FinanceReports from './pages/admin/FinanceReports';
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard';
import SecurityLogs from './pages/admin/SecurityLogs';
import DocumentBuilder from './pages/admin/DocumentBuilder';
import NotFoundPage from './pages/NotFoundPage';
import AdminLayout from './components/admin/AdminLayout';

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

  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-base-100">
      {!isAdminRoute && <Navbar />}
      {!isAdminRoute && <BottomNavbar />}
      <main className="">
        <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Public product/collection/cart/wishlist routes */}
          {/* ... */}
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/styles/:style" element={<Styles />} />
          <Route path="/product/:productId" element={<ProductPage />} />
          <Route path="/compare" element={<CompareProducts />} />
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
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/payment/verify" element={<PaymentVerify />} />
          <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
          <Route path="/orders" element={<OrderHistoryPage />} />
          <Route path="/track-order" element={<TrackOrderPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/loyalty" element={<LoyaltyPage />} />
          <Route path="/aboutUs" element={<AboutUs />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/faqs" element={<FAQ />} />
          <Route path="/consultation" element={<Consultation />} />
          <Route path="/e-catalog" element={<ECatalog />} />
          <Route path="/showroom" element={<Showroom />} />
          <Route
            path="/reset-password/:token"
            element={<ResetPasswordPage />}
          />

          <Route element={<AdminLoginProtectedRoute />}>
            <Route path="/admin/login" element={<AdminLoginPage />} />
          </Route>

          {/* Admin Protected Routes — all wrapped in AdminLayout */}
          <Route element={<AdminProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard" element={<Dashboard />} />
              <Route path="/admin/products/new" element={<AdminAddProductPage />} />
              <Route path="/admin/products/edit/:productId" element={<AdminEditProductPage />} />
              <Route path="/admin/collections/new" element={<AddCollection />} />
              <Route path="/admin/collections/edit/:collectionId" element={<EditCollection />} />
              <Route path="/admin/addProject" element={<AdminAddProjectPage />} />
              <Route path="/admin/editProject/:projectId" element={<AdminEditProjectPage />} />
              <Route path="/admin/coupons" element={<CouponManagement />} />
              <Route path="/admin/orders" element={<OrderManagement />} />
              <Route path="/admin/reviews" element={<ReviewModeration />} />
              <Route path="/admin/consultations" element={<ConsultationManagement />} />
              <Route path="/admin/designers" element={<DesignerManagement />} />
              <Route path="/admin/marketing" element={<MarketingManagement />} />
              <Route path="/admin/inventory" element={<InventoryManagement />} />
              <Route path="/admin/finance" element={<FinanceReports />} />
              <Route path="/admin/analytics" element={<AnalyticsDashboard />} />
              <Route path="/admin/security-logs" element={<SecurityLogs />} />
              <Route path="/admin/documents" element={<DocumentBuilder />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </AnimatePresence>{' '}
      </main>
      {!isAdminRoute && <Footer />}
      {!isAdminRoute && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-25 lg:bottom-6 right-5 z-40 size-16 flex items-center justify-center rounded-full bg-green-600 shadow-lg hover:bg-green-700 hover:shadow-xl transition-colors duration-300"
          aria-label="Chat on WhatsApp"
        >
          <img
            src={
              'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/whatsapp_4401461_vssasq.png'
            }
            alt="WhatsApp Chat"
            className="w-10 h-10 object-contain"
          />
        </a>
      )}
      {!authUser && isAuthReady && <CookieConsentBanner />}
      <Toaster />
    </div>
  );
}

export default App;
