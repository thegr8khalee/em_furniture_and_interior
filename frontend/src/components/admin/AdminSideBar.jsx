import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useAdminStore } from '../../store/useAdminStore';
import { PERMISSIONS } from '../../lib/permissions';
import {
  X,
  LayoutDashboard,
  Package,
  FolderOpen,
  Briefcase,
  FileText,
  HelpCircle,
  Palette,
  ShoppingCart,
  Ticket,
  Warehouse,
  Megaphone,
  Star,
  BarChart3,
  DollarSign,
  Shield,
  MessageSquare,
  LogOut,
  ChevronDown,
  Receipt,
} from 'lucide-react';
import { useState } from 'react';

/* ── navigation config ──────────────────────────────── */
const navGroups = [
  {
    label: null, // no group header
    items: [
      { to: '/admin/dashboard', section: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: PERMISSIONS.ADMIN_DASHBOARD_VIEW },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/admin/dashboard', section: 'products', label: 'Products', icon: Package, permission: PERMISSIONS.PRODUCTS_MANAGE },
      { to: '/admin/dashboard', section: 'collections', label: 'Collections', icon: FolderOpen, permission: PERMISSIONS.COLLECTIONS_MANAGE },
      { to: '/admin/dashboard', section: 'projects', label: 'Projects', icon: Briefcase, permission: PERMISSIONS.PROJECTS_MANAGE },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/admin/dashboard', section: 'blog', label: 'Blog', icon: FileText, permission: PERMISSIONS.BLOG_MANAGE },
      { to: '/admin/dashboard', section: 'faqs', label: 'FAQs', icon: HelpCircle, permission: PERMISSIONS.FAQ_MANAGE },
      { to: '/admin/designers', label: 'Designers', icon: Palette, permission: PERMISSIONS.DESIGNERS_MANAGE },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: ShoppingCart, permission: PERMISSIONS.ORDERS_VIEW },
      { to: '/admin/coupons', label: 'Coupons', icon: Ticket, permission: PERMISSIONS.MARKETING_MANAGE },
      { to: '/admin/inventory', label: 'Inventory', icon: Warehouse, permission: PERMISSIONS.INVENTORY_MANAGE },
      { to: '/admin/documents', label: 'Document Builder', icon: Receipt, permission: PERMISSIONS.FINANCE_VIEW },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { to: '/admin/marketing', label: 'Promo & Flash Sales', icon: Megaphone, permission: PERMISSIONS.MARKETING_MANAGE },
      { to: '/admin/reviews', label: 'Reviews', icon: Star, permission: PERMISSIONS.REVIEWS_MANAGE },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, permission: PERMISSIONS.ADMIN_DASHBOARD_VIEW },
      { to: '/admin/finance', label: 'Finance', icon: DollarSign, permission: PERMISSIONS.FINANCE_VIEW },
      { to: '/admin/security-logs', label: 'Security Logs', icon: Shield, permission: PERMISSIONS.ADMIN_DASHBOARD_VIEW },
    ],
  },
  {
    label: 'Customer',
    items: [
      { to: '/admin/consultations', label: 'Consultations', icon: MessageSquare, permission: PERMISSIONS.CONSULTATIONS_MANAGE },
    ],
  },
];

/* ── component ──────────────────────────────────────── */
const AdminSidebar = () => {
  const logout = useAuthStore((s) => s.logout);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const authUser = useAuthStore((s) => s.authUser);
  const { isSidebarOpen, closeSidebar } = useAdminStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Track collapsed groups
  const [collapsed, setCollapsed] = useState({});
  const toggle = (label) => setCollapsed((p) => ({ ...p, [label]: !p[label] }));

  const currentDashboardSection =
    location.pathname === '/admin/dashboard'
      ? new URLSearchParams(location.search).get('section') || 'dashboard'
      : null;

  const handleDashboardNav = (section = 'dashboard') => {
    const suffix = section === 'dashboard' ? '' : `?section=${section}`;
    navigate(`/admin/dashboard${suffix}`);
    closeSidebar();
  };

  const initials = (authUser?.username || authUser?.email || 'A')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const roleName = (authUser?.role || 'admin').replace(/_/g, ' ');

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-base-300
        bg-white shadow-luxury transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      {/* ── brand / close ── */}
      <div className="flex h-14 items-center justify-between border-b border-base-300 px-5">
        <span className="font-heading text-lg font-bold tracking-wide text-primary">
          EM Admin
        </span>
        <button
          className="btn btn-ghost btn-sm btn-square lg:hidden"
          onClick={closeSidebar}
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── nav groups ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((it) => hasPermission(it.permission));
          if (visibleItems.length === 0) return null;

          const isGroupActive = visibleItems.some((item) => {
            if (item.section) {
              return location.pathname === '/admin/dashboard' && currentDashboardSection === item.section;
            }
            return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
          });

          const isCollapsed = group.label ? (collapsed[group.label] ?? !isGroupActive) : false;

          return (
            <div key={group.label || '__main'}>
              {/* Group header */}
              {group.label && (
                <button
                  onClick={() => toggle(group.label)}
                  className="mt-4 mb-1 flex w-full items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral/40 hover:text-neutral/60 transition-colors"
                >
                  {group.label}
                  <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>
              )}

              {/* Items */}
              {!isCollapsed &&
                visibleItems.map((item) => {
                  const Icon = item.icon;

                  // Dashboard sub-sections use custom handler
                  if (item.section) {
                    const isActive = location.pathname === '/admin/dashboard' && currentDashboardSection === item.section;
                    return (
                      <button
                        key={item.section}
                        onClick={() => handleDashboardNav(item.section)}
                        className={`
                          group flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200
                          ${isActive
                            ? 'border-l-2 border-secondary bg-secondary/5 font-medium text-secondary'
                            : 'border-l-2 border-transparent text-neutral/70 hover:border-secondary/30 hover:bg-base-200 hover:text-neutral'
                          }
                        `}
                      >
                        <Icon size={18} className={isActive ? 'text-secondary' : 'text-neutral/40 group-hover:text-neutral/60'} />
                        {item.label}
                      </button>
                    );
                  }

                  // Regular route-based nav
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={closeSidebar}
                      className={({ isActive }) => `
                        group flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200
                        ${isActive
                          ? 'border-l-2 border-secondary bg-secondary/5 font-medium text-secondary'
                          : 'border-l-2 border-transparent text-neutral/70 hover:border-secondary/30 hover:bg-base-200 hover:text-neutral'
                        }
                      `}
                    >
                      <Icon size={18} className="text-neutral/40 group-[.border-secondary]:text-secondary group-hover:text-neutral/60" />
                      {item.label}
                    </NavLink>
                  );
                })}
            </div>
          );
        })}
      </nav>

      {/* ── footer ── */}
      <div className="border-t border-base-300 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-primary-content text-xs font-bold tracking-wider">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral">
              {authUser?.username || authUser?.email}
            </p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-neutral/50">
              {roleName}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="btn btn-ghost btn-sm w-full justify-start gap-2 text-error hover:bg-error/10"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
