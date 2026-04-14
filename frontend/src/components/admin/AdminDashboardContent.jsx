import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProductsStore } from '../../store/useProductsStore';
import { useCollectionStore } from '../../store/useCollectionStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import { axiosInstance } from '../../lib/axios';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import {
  Package,
  FolderOpen,
  Briefcase,
  ShoppingCart,
  Plus,
  ArrowRight,
  TrendingUp,
  MapPin,
  Star,
  Eye,
  Tag,
} from 'lucide-react';

const StatCard = ({ label, value, icon: Icon, color = 'text-primary', loading, onClick }) => (
  <Card className={`flex items-start gap-4 ${onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`} onClick={onClick}>
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center bg-base-200 ${color}`}>
      <Icon size={20} />
    </div>
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral/50">{label}</p>
      {loading ? (
        <div className="mt-1 h-8 w-16 animate-pulse bg-base-200" />
      ) : (
        <p className="text-2xl font-bold text-neutral">{value ?? '—'}</p>
      )}
    </div>
  </Card>
);

const formatPrice = (val) =>
  '₦' + Number(val).toLocaleString('en-NG', { minimumFractionDigits: 0 });

/* ─── Compact item cards for dashboard previews ─── */
const ProductMiniCard = ({ item, onClick }) => {
  const imgSrc = item.images?.[0]?.url || item.images?.[0] || '';
  return (
    <div className="group flex flex-col border border-base-300 bg-white transition-shadow hover:shadow-md cursor-pointer" onClick={onClick}>
      <div className="relative aspect-[4/3] overflow-hidden bg-base-200">
        {imgSrc ? (
          <img src={imgSrc} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral/20">No image</div>
        )}
        {item.isPromo && (
          <span className="absolute left-1.5 top-1.5 bg-error px-1.5 py-px text-[9px] font-bold uppercase text-white">Promo</span>
        )}
        <div className="absolute right-1.5 top-1.5">
          <span className={`px-1.5 py-px text-[9px] font-bold uppercase ${item.sold ? 'bg-neutral/70 text-white' : 'bg-success/80 text-white'}`}>
            {item.sold ? 'Sold' : 'Available'}
          </span>
        </div>
      </div>
      <div className="p-2.5">
        <p className="truncate text-xs font-semibold text-neutral">{item.title}</p>
        <p className="mt-0.5 text-[10px] text-neutral/40">{item.category || 'Uncategorized'}</p>
        <p className="mt-1 text-sm font-bold text-neutral">{formatPrice(item.price)}</p>
      </div>
    </div>
  );
};

const CollectionMiniCard = ({ item, onClick }) => {
  const imgSrc = item.coverImage?.url || '';
  return (
    <div className="group flex flex-col border border-base-300 bg-white transition-shadow hover:shadow-md cursor-pointer" onClick={onClick}>
      <div className="relative aspect-[4/3] overflow-hidden bg-base-200">
        {imgSrc ? (
          <img src={imgSrc} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral/20">No image</div>
        )}
        {item.isBestSeller && (
          <span className="absolute left-1.5 top-1.5 bg-secondary px-1.5 py-px text-[9px] font-bold uppercase text-white">Best Seller</span>
        )}
      </div>
      <div className="p-2.5">
        <p className="truncate text-xs font-semibold text-neutral">{item.name}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-neutral/40">
          <span className="flex items-center gap-0.5"><Tag size={9} />{item.style}</span>
          <span>{item.productIds?.length || 0} items</span>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <Star size={10} className="fill-yellow-500 text-yellow-500" />
          <span className="text-[10px] text-neutral/50">{item.averageRating || 0}</span>
          <span className="ml-auto text-sm font-bold text-neutral">{formatPrice(item.price)}</span>
        </div>
      </div>
    </div>
  );
};

const ProjectMiniCard = ({ item, onClick }) => {
  const imgSrc = item.images?.[0]?.url || item.images?.[0] || '';
  return (
    <div className="group flex flex-col border border-base-300 bg-white transition-shadow hover:shadow-md cursor-pointer" onClick={onClick}>
      <div className="relative aspect-[4/3] overflow-hidden bg-base-200">
        {imgSrc ? (
          <img src={imgSrc} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral/20">No image</div>
        )}
        {item.category && (
          <span className="absolute left-1.5 top-1.5 bg-info/90 px-1.5 py-px text-[9px] font-bold uppercase text-white">{item.category}</span>
        )}
      </div>
      <div className="p-2.5">
        <p className="truncate text-xs font-semibold text-neutral">{item.title}</p>
        <p className="mt-0.5 flex items-center gap-0.5 text-[10px] text-neutral/40"><MapPin size={9} />{item.location || 'No location'}</p>
        <p className="mt-1 text-sm font-bold text-neutral">{formatPrice(item.price)}</p>
      </div>
    </div>
  );
};

const SkeletonGrid = ({ count = 4 }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="border border-base-300 bg-white">
        <div className="aspect-[4/3] animate-pulse bg-base-200" />
        <div className="space-y-2 p-2.5">
          <div className="h-3 w-3/4 animate-pulse bg-base-200" />
          <div className="h-3 w-1/2 animate-pulse bg-base-200" />
        </div>
      </div>
    ))}
  </div>
);

const AdminDashboardContent = () => {
  const navigate = useNavigate();
  const { products, productsCount, getProductsCount, getProducts, isGettingProducts } = useProductsStore();
  const { collections, collectionsCount, getCollectionsCount, getCollections, isGettingCollections } = useCollectionStore();
  const { projects, getProjectsCount, totalCount: projectsCount, fetchProjects, loading: isGettingProjects } = useProjectsStore();

  const [orderStats, setOrderStats] = useState({ total: null, pending: null });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loadingExtra, setLoadingExtra] = useState(true);

  useEffect(() => {
    getProductsCount();
    getCollectionsCount();
    getProjectsCount();
    // Fetch recent items for previews
    getProducts(1, 4, {}, false);
    getCollections(1, 4, {}, false);
    fetchProjects(1, 4);
  }, [getProductsCount, getCollectionsCount, getProjectsCount, getProducts, getCollections, fetchProjects]);

  useEffect(() => {
    const fetchExtra = async () => {
      try {
        const res = await axiosInstance.get('/orders/admin/all?page=1&limit=5');
        setRecentOrders(res.data.orders || []);
        setOrderStats({
          total: res.data.totalOrders ?? res.data.orders?.length ?? 0,
          pending: (res.data.orders || []).filter((o) => o.status === 'pending').length,
        });
      } catch {
        /* non-critical */
      } finally {
        setLoadingExtra(false);
      }
    };
    fetchExtra();
  }, []);

  const loading = isGettingProducts || isGettingCollections;

  const stats = [
    { label: 'Products', value: productsCount, icon: Package, color: 'text-primary', onClick: () => navigate('/admin/dashboard?section=products') },
    { label: 'Collections', value: collectionsCount, icon: FolderOpen, color: 'text-secondary', onClick: () => navigate('/admin/dashboard?section=collections') },
    { label: 'Projects', value: projectsCount, icon: Briefcase, color: 'text-info', onClick: () => navigate('/admin/dashboard?section=projects') },
    { label: 'Total Orders', value: orderStats.total, icon: ShoppingCart, color: 'text-success', onClick: () => navigate('/admin/orders') },
  ];

  const quickActions = [
    { label: 'Add Product', to: '/admin/products/new', icon: Plus },
    { label: 'Add Collection', to: '/admin/collections/new', icon: Plus },
    { label: 'Add Project', to: '/admin/addProject', icon: Plus },
    { label: 'View Orders', to: '/admin/orders', icon: ArrowRight },
    { label: 'Manage Coupons', to: '/admin/coupons', icon: ArrowRight },
    { label: 'View Analytics', to: '/admin/analytics', icon: TrendingUp },
  ];

  return (
    <div className="space-y-8">
      {/* Page title */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-neutral lg:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral/50">Overview of your store performance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} loading={loading || loadingExtra} />
        ))}
      </div>

      {/* Recent Products */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral/60">Recent Products</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dashboard?section=products')} rightIcon={ArrowRight}>
            View All
          </Button>
        </div>
        {isGettingProducts && products.length === 0 ? (
          <SkeletonGrid />
        ) : products.length === 0 ? (
          <Card className="py-8 text-center text-sm text-neutral/50">No products yet</Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.slice(0, 4).map((p) => (
              <ProductMiniCard key={p._id} item={p} onClick={() => navigate(`/admin/products/edit/${p._id}`)} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Collections */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral/60">Recent Collections</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dashboard?section=collections')} rightIcon={ArrowRight}>
            View All
          </Button>
        </div>
        {isGettingCollections && collections.length === 0 ? (
          <SkeletonGrid />
        ) : collections.length === 0 ? (
          <Card className="py-8 text-center text-sm text-neutral/50">No collections yet</Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {collections.slice(0, 4).map((c) => (
              <CollectionMiniCard key={c._id} item={c} onClick={() => navigate(`/admin/collections/edit/${c._id}`)} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Projects */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral/60">Recent Projects</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dashboard?section=projects')} rightIcon={ArrowRight}>
            View All
          </Button>
        </div>
        {isGettingProjects && projects.length === 0 ? (
          <SkeletonGrid />
        ) : projects.length === 0 ? (
          <Card className="py-8 text-center text-sm text-neutral/50">No projects yet</Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {projects.slice(0, 4).map((p) => (
              <ProjectMiniCard key={p._id} item={p} onClick={() => navigate(`/admin/editProject/${p._id}`)} />
            ))}
          </div>
        )}
      </div>

      {/* Recent orders */}
      <Card padding="p-0">
        <div className="flex items-center justify-between border-b border-base-300 px-6 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral/60">Recent Orders</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/orders')} rightIcon={ArrowRight}>
            View All
          </Button>
        </div>
        {loadingExtra ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse bg-base-200" />
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <p className="p-6 text-center text-sm text-neutral/50">No orders yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base-300 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral/40">
                  <th className="px-6 py-3">Order</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order._id} className="border-b border-base-200 last:border-0 hover:bg-base-100 transition-colors">
                    <td className="px-6 py-3 font-medium">{order.orderNumber}</td>
                    <td className="px-6 py-3 text-neutral/70">{order.shippingAddress?.fullName || '—'}</td>
                    <td className="px-6 py-3">
                      <Badge status={order.status} />
                    </td>
                    <td className="px-6 py-3 text-right font-medium">
                      ₦{(order.totalAmount || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick actions */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-neutral/60">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickActions.map((a) => (
            <Button
              key={a.label}
              variant="elegant-outline"
              size="sm"
              className="w-full justify-start"
              leftIcon={a.icon}
              onClick={() => navigate(a.to)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardContent;
