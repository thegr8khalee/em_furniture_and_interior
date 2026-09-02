import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@em/domain';
import AdminProtectedRoute from './components/AdminProtectedRoutes';
import AdminLoginProtectedRoute from './components/AdminLoginProtectedRoute';

// Paths keep their /admin prefix so existing staff bookmarks and every internal
// link in the console continue to resolve, even though this is now its own
// deployment.
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
  <div className="min-h-screen flex items-center justify-center bg-base-100">
    <Loader2 className="h-8 w-8 animate-spin text-secondary" />
  </div>
);

function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <div className="min-h-screen bg-base-100">
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location}>
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

          {/* The console has no public surface, so anything unrecognised — the
              bare root included — goes to the dashboard, which in turn bounces
              to the login screen when there is no session. */}
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </div>
  );
}

export default App;
