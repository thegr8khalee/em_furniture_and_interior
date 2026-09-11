import { useAdminStore, useAdminAuthStore } from '@em/domain';
import { Menu, ExternalLink } from 'lucide-react';
import AdminBreadcrumb from './AdminBreadcrumb';

const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:5173';

const AdminHeader = () => {
  const { adminUser: authUser } = useAdminAuthStore();
  const { toggleSidebar } = useAdminStore();

  const initials = (authUser?.username || authUser?.email || 'A')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const roleName = (authUser?.role || 'admin').replace(/_/g, ' ');

  return (
    <header className="flex items-center justify-between gap-4 border-b border-base-300 bg-white px-4 py-3 lg:px-8">
      {/* Left: hamburger + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          className="btn btn-ghost btn-sm btn-square lg:hidden"
          onClick={toggleSidebar}
          aria-label="Open sidebar"
        >
          <Menu size={20} />
        </button>
        <AdminBreadcrumb />
      </div>

      {/* Right: storefront link + admin info */}
      <div className="flex items-center gap-3 sm:gap-4">
        <a
          href={STOREFRONT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 border border-base-300 px-3 py-1.5 text-xs font-semibold text-neutral/70 hover:border-secondary hover:text-secondary transition-colors"
          title="Open live customer storefront"
        >
          <span>View Storefront</span>
          <ExternalLink size={13} />
        </a>

        <div className="hidden sm:flex flex-col items-end">
          <span className="text-sm font-medium text-neutral leading-tight">
            {authUser?.username || authUser?.email}
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-neutral/50">
            {roleName}
          </span>
        </div>
        <div className="flex h-9 w-9 items-center justify-center bg-primary text-primary-content text-xs font-bold tracking-wider">
          {initials}
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
