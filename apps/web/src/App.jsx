// src/App.jsx
import React, { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAuthStore, useCollectionStore, useProductsStore } from '@em/domain';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import BottomNavbar from './components/BottomNavbar';
import Footer from './components/Footer';
import CookieConsentBanner from './components/CookieConsentBanner';

// Public routes — eager-loaded so the home page has no splash on first paint
import HomePage from './pages/HomePage';
import Shop from './pages/Shop';
import ProductPage from './pages/ProductPage';
import CollectionDetailsPage from './pages/CollectionDetailPage';
import Styles from './pages/Styles';
import NotFoundPage from './pages/NotFoundPage';

// Public but less-critical — lazy to keep initial bundle small
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/Signup'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const CartPage = lazy(() => import('./pages/Cart'));
const WishlistPage = lazy(() => import('./pages/Wishlist'));
const CompareProducts = lazy(() => import('./pages/CompareProducts'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Contact = lazy(() => import('./pages/Contact'));
const ECatalog = lazy(() => import('./pages/ECatalog'));
const Showroom = lazy(() => import('./pages/Showroom'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const Projects = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Consultation = lazy(() => import('./pages/Consultation'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrderConfirmationPage = lazy(() => import('./pages/OrderConfirmationPage'));
const PaymentVerify = lazy(() => import('./pages/PaymentVerify'));
const OrderHistoryPage = lazy(() => import('./pages/OrderHistoryPage'));
const TrackOrderPage = lazy(() => import('./pages/TrackOrderPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const LoyaltyPage = lazy(() => import('./pages/LoyaltyPage'));


const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-base-100">
    <Loader2 className="h-8 w-8 animate-spin text-secondary" />
  </div>
);

function App() {
  const { checkAuth, authUser, isAuthReady } = useAuthStore();
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

  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />
      <BottomNavbar />
      <main className="">
        <AnimatePresence mode="wait">
        <Suspense fallback={<RouteFallback />}>
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
            element={authUser ? <ProfilePage /> : <LoginPage />}
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

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
        </AnimatePresence>{' '}
      </main>
      <Footer />
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
      {!authUser && isAuthReady && <CookieConsentBanner />}
      <Toaster />
    </div>
  );
}

export default App;
