import { useLocation, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const routeLabels = {
  dashboard: 'Dashboard',
  products: 'Products',
  collections: 'Collections',
  projects: 'Projects',
  blog: 'Blog',
  faqs: 'FAQs',
  orders: 'Orders',
  coupons: 'Coupons',
  reviews: 'Reviews',
  consultations: 'Consultations',
  designers: 'Designers',
  marketing: 'Marketing',
  inventory: 'Inventory',
  finance: 'Sales revenue',
  books: 'Books',
  customers: 'Customers',
  statements: 'Statements',
  sales: 'Sales',
  staff: 'Operators',
  payroll: 'Payroll',
  reconciliation: 'Bank reconciliation',
  warehouse: 'Warehouse',
  purchasing: 'Purchasing',
  vendors: 'Vendors',
  analytics: 'Analytics',
  'security-logs': 'Security Logs',
  new: 'New',
  edit: 'Edit',
  addProject: 'New Project',
  editProject: 'Edit Project',
};

const IS_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AdminBreadcrumb = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const dashboardSection = searchParams.get('section');
  const segments = location.pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean);

  const resolvedSegments =
    location.pathname === '/admin/dashboard' && dashboardSection && dashboardSection !== 'dashboard'
      ? ['dashboard', dashboardSection]
      : segments;

  return (
    <nav className="flex items-center gap-1.5 text-xs tracking-wide text-neutral/50">
      <Link to="/admin/dashboard" className="hover:text-secondary transition-colors">
        Admin
      </Link>
      {resolvedSegments.map((seg, i) => {
        const path =
          seg === 'dashboard' || resolvedSegments[i - 1] === 'dashboard'
            ? `/admin/dashboard${seg !== 'dashboard' ? `?section=${seg}` : ''}`
            : '/admin/' + resolvedSegments.slice(0, i + 1).join('/');
        // A record id is not a label. Printing the raw uuid gives a
        // breadcrumb nobody can read and that wraps onto two lines; the page
        // title already names the thing being looked at.
        const label = routeLabels[seg] || (IS_ID.test(seg) ? 'Detail' : seg);
        const isLast = i === resolvedSegments.length - 1;

        return (
          <span key={path} className="flex items-center gap-1.5">
            <ChevronRight size={12} />
            {isLast ? (
              <span className="text-neutral/80 font-medium">{label}</span>
            ) : (
              <Link to={path} className="hover:text-secondary transition-colors">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export default AdminBreadcrumb;
