import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@em/domain';
import AdminProtectedRoute from './components/AdminProtectedRoutes';
import AdminLoginProtectedRoute from './components/AdminLoginProtectedRoute';

/**
 * Operations console.
 *
 * Deployed separately from the storefront and access-restricted, so console
 * code never reaches a public visitor. Routes keep their existing /admin/*
 * paths: staff bookmarks and the sidebar's links are unchanged, and keeping
 * them identical is what lets this ship without anyone noticing.
 */

const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AddProductPage = lazy(() => import('./pages/AddProductPage'));
const EditProductPage = lazy(() => import('./pages/EditProductPage'));
const AddCollection = lazy(() => import('./pages/AddCollection'));
const EditCollection = lazy(() => import('./pages/EditCollection'));
const AddProject = lazy(() => import('./pages/AddProject'));
const EditProject = lazy(() => import('./pages/EditProject'));
const CouponManagement = lazy(() => import('./pages/admin/CouponManagement'));
const OrderManagement = lazy(() => import('./pages/admin/OrderManagement'));
const ReviewModeration = lazy(() => import('./pages/admin/ReviewModeration'));
const ConsultationManagement = lazy(() => import('./pages/admin/ConsultationManagement'));
const DesignerManagement = lazy(() => import('./pages/admin/DesignerManagement'));
const MarketingManagement = lazy(() => import('./pages/admin/MarketingManagement'));
const InventoryManagement = lazy(() => import('./pages/admin/InventoryManagement'));
const FinanceReports = lazy(() => import('./pages/admin/FinanceReports'));
const AnalyticsDashboard = lazy(() => import('./pages/admin/AnalyticsDashboard'));
const SecurityLogs = lazy(() => import('./pages/admin/SecurityLogs'));
const DocumentBuilder = lazy(() => import('./pages/admin/DocumentBuilder'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-base-100">
    <Loader2 className="size-8 animate-spin text-primary" />
  </div>
);

const App = () => {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <div className="min-h-screen bg-base-100">
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<AdminLoginProtectedRoute />}>
            <Route path="/admin/login" element={<AdminLoginPage />} />
          </Route>

          <Route element={<AdminProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard" element={<Dashboard />} />
              <Route path="/admin/products/new" element={<AddProductPage />} />
              <Route path="/admin/products/edit/:productId" element={<EditProductPage />} />
              <Route path="/admin/collections/new" element={<AddCollection />} />
              <Route path="/admin/collections/edit/:collectionId" element={<EditCollection />} />
              <Route path="/admin/addProject" element={<AddProject />} />
              <Route path="/admin/editProject/:projectId" element={<EditProject />} />
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

          {/* The console owns no public pages; anything else goes to the console root. */}
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </Suspense>
      <Toaster position="top-center" />
    </div>
  );
};

export default App;
