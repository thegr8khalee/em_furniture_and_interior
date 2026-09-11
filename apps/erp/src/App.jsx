import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { useAdminAuthStore } from '@em/domain';
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
const OrderDetail = lazy(() => import('./pages/admin/OrderDetail'));
const CounterSale = lazy(() => import('./pages/admin/CounterSale'));
const ReviewModeration = lazy(() => import('./pages/admin/ReviewModeration'));
const ConsultationManagement = lazy(() => import('./pages/admin/ConsultationManagement'));
const DesignerManagement = lazy(() => import('./pages/admin/DesignerManagement'));
const MarketingManagement = lazy(() => import('./pages/admin/MarketingManagement'));
const InventoryManagement = lazy(() => import('./pages/admin/InventoryManagement'));
const FinanceReports = lazy(() => import('./pages/admin/FinanceReports'));
const Books = lazy(() => import('./pages/admin/Books'));
const Statements = lazy(() => import('./pages/admin/Statements'));
const Purchasing = lazy(() => import('./pages/admin/Purchasing'));
const VendorDetail = lazy(() => import('./pages/admin/VendorDetail'));
const PurchaseOrderDetail = lazy(() => import('./pages/admin/PurchaseOrderDetail'));
const Customers = lazy(() => import('./pages/admin/Customers'));
const CustomerDetail = lazy(() => import('./pages/admin/CustomerDetail'));
const Staff = lazy(() => import('./pages/admin/Staff'));
const StaffDetail = lazy(() => import('./pages/admin/StaffDetail'));
const Payroll = lazy(() => import('./pages/admin/Payroll'));
const Reconciliation = lazy(() => import('./pages/admin/Reconciliation'));
const Warehouse = lazy(() => import('./pages/admin/Warehouse'));
const AnalyticsDashboard = lazy(() => import('./pages/admin/AnalyticsDashboard'));
const SecurityLogs = lazy(() => import('./pages/admin/SecurityLogs'));
const DocumentBuilder = lazy(() => import('./pages/admin/DocumentBuilder'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));

// The catalogue and content screens, which used to be reachable only as
// `/admin/dashboard?section=...`.
const ProductManagement = lazy(() => import('./components/admin/ProductManagement'));
const ProductDetail = lazy(() => import('./pages/admin/ProductDetail'));
const CollectionManagement = lazy(() => import('./components/admin/CollectionManagement'));
const ProjectManagement = lazy(() => import('./components/admin/ProjectManagement'));
const BlogManagement = lazy(() => import('./components/admin/BlogManagement'));
const FAQManagement = lazy(() => import('./components/admin/FAQManagement'));

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-base-100">
    <Loader2 className="h-8 w-8 animate-spin text-secondary" />
  </div>
);

function App() {
  const checkAdminAuth = useAdminAuthStore((s) => s.checkAdminAuth);
  const location = useLocation();

  useEffect(() => {
    checkAdminAuth();
  }, [checkAdminAuth]);

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

              {/* Static segments outrank the dynamic ones below them, so
                  /admin/products/new is still the new-product form. */}
              <Route path="/admin/products" element={<ProductManagement />} />
              <Route path="/admin/collections" element={<CollectionManagement />} />
              <Route path="/admin/projects" element={<ProjectManagement />} />
              <Route path="/admin/blog" element={<BlogManagement />} />
              <Route path="/admin/faqs" element={<FAQManagement />} />
              <Route path="/admin/products/new" element={<AddProductPage />} />
              <Route path="/admin/products/edit/:productId" element={<EditProductPage />} />
              <Route path="/admin/products/:productId" element={<ProductDetail />} />
              <Route path="/admin/collections/new" element={<AddCollection />} />
              <Route path="/admin/collections/edit/:collectionId" element={<EditCollection />} />
              <Route path="/admin/addProject" element={<AddProject />} />
              <Route path="/admin/addproject" element={<Navigate to="/admin/addProject" replace />} />
              <Route path="/admin/projects/new" element={<Navigate to="/admin/addProject" replace />} />
              <Route path="/admin/editProject/:projectId" element={<EditProject />} />
              <Route path="/admin/coupons" element={<CouponManagement />} />
              <Route path="/admin/orders" element={<OrderManagement />} />
              <Route path="/admin/orders/:orderId" element={<OrderDetail />} />
              <Route path="/admin/sales/new" element={<CounterSale />} />
              <Route path="/admin/reviews" element={<ReviewModeration />} />
              <Route path="/admin/consultations" element={<ConsultationManagement />} />
              <Route path="/admin/designers" element={<DesignerManagement />} />
              <Route path="/admin/marketing" element={<MarketingManagement />} />
              <Route path="/admin/inventory" element={<InventoryManagement />} />
              <Route path="/admin/finance" element={<FinanceReports />} />
              <Route path="/admin/books" element={<Books />} />
              <Route path="/admin/statements" element={<Statements />} />
              <Route path="/admin/purchasing" element={<Purchasing />} />
              <Route path="/admin/purchasing/vendors/:vendorId" element={<VendorDetail />} />
              <Route
                path="/admin/purchasing/orders/:orderId"
                element={<PurchaseOrderDetail />}
              />
              <Route path="/admin/customers" element={<Customers />} />
              <Route path="/admin/customers/:customerId" element={<CustomerDetail />} />
              <Route path="/admin/staff" element={<Staff />} />
              <Route path="/admin/staff/:staffId" element={<StaffDetail />} />
              <Route path="/admin/payroll" element={<Payroll />} />
              <Route path="/admin/reconciliation" element={<Reconciliation />} />
              <Route path="/admin/warehouse" element={<Warehouse />} />
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
