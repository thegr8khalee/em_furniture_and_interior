import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '../../store/useAdminStore';
import { useProductsStore } from '../../store/useProductsStore';
import { Eye, Pencil, Trash2, Star, X } from 'lucide-react';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';

const formatPrice = (val) =>
  '₦' + Number(val).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AdminProductListCard = ({ item, viewMode = 'grid' }) => {
  const [showDetail, setShowDetail] = useState(false);
  const { delProduct } = useAdminStore();
  const { getProducts } = useProductsStore();
  const navigate = useNavigate();

  const handleEdit = () => navigate(`/admin/products/edit/${item._id}`);

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      delProduct(item._id).then(() => getProducts(1, 12, {}, false));
    }
  };

  const isDiscounted = item.isPromo && item.discountedPrice != null && item.discountedPrice < item.price;
  const imgSrc = item.images?.[0]?.url || item.images?.[0] || '';

  /* ─── Grid card ─── */
  if (viewMode === 'grid') {
    return (
      <>
        <div className="group relative flex flex-col border border-base-300 bg-white transition-shadow hover:shadow-lg">
          {/* Badges */}
          <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
            {item.isBestSeller && (
              <span className="bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Best Seller</span>
            )}
            {item.isPromo && (
              <span className="bg-error px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Promo</span>
            )}
          </div>
          {/* Status */}
          <div className="absolute right-2 top-2 z-10">
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${item.sold ? 'bg-neutral/80 text-white' : 'bg-success/90 text-white'}`}>
              {item.sold ? 'Sold' : 'Available'}
            </span>
          </div>
          {/* Image */}
          <div className="relative aspect-[4/3] overflow-hidden bg-base-200">
            {imgSrc ? (
              <img src={imgSrc} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            ) : (
              <div className="flex h-full items-center justify-center text-neutral/20">No image</div>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
              <button onClick={() => setShowDetail(true)} className="flex h-9 w-9 items-center justify-center bg-white text-primary transition-colors hover:bg-secondary hover:text-white" title="View">
                <Eye size={16} />
              </button>
              <button onClick={handleEdit} className="flex h-9 w-9 items-center justify-center bg-white text-primary transition-colors hover:bg-secondary hover:text-white" title="Edit">
                <Pencil size={16} />
              </button>
              <button onClick={handleDelete} className="flex h-9 w-9 items-center justify-center bg-white text-error transition-colors hover:bg-error hover:text-white" title="Delete">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          {/* Info */}
          <div className="flex flex-1 flex-col p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral/40">{item.category || 'Uncategorized'}</p>
            <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-neutral">{item.title}</h3>
            <div className="mt-auto pt-2">
              {isDiscounted ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold text-error">{formatPrice(item.discountedPrice)}</span>
                  <span className="text-xs text-neutral/40 line-through">{formatPrice(item.price)}</span>
                </div>
              ) : (
                <span className="text-base font-bold text-neutral">{formatPrice(item.price)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Detail modal */}
        <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={item.title}>
          <ProductDetailView item={item} onClose={() => setShowDetail(false)} onEdit={handleEdit} />
        </Modal>
      </>
    );
  }

  /* ─── List row ─── */
  return (
    <>
      <div className="group flex items-center gap-4 border border-base-300 bg-white p-3 transition-shadow hover:shadow-md">
        <div className="h-16 w-20 flex-shrink-0 overflow-hidden bg-base-200">
          {imgSrc ? (
            <img src={imgSrc} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-neutral/20">No img</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-sm font-semibold text-neutral">{item.title}</h3>
          <p className="text-xs text-neutral/50">{item.category || 'Uncategorized'}</p>
        </div>
        <div className="hidden sm:block">
          {isDiscounted ? (
            <div className="text-right">
              <span className="text-sm font-bold text-error">{formatPrice(item.discountedPrice)}</span>
              <span className="ml-2 text-xs text-neutral/40 line-through">{formatPrice(item.price)}</span>
            </div>
          ) : (
            <span className="text-sm font-bold text-neutral">{formatPrice(item.price)}</span>
          )}
        </div>
        <div className="hidden sm:block">
          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${item.sold ? 'bg-neutral/10 text-neutral/60' : 'bg-success/10 text-success'}`}>
            {item.sold ? 'Sold' : 'Available'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowDetail(true)} className="p-2 text-neutral/40 transition-colors hover:text-primary" title="View"><Eye size={16} /></button>
          <button onClick={handleEdit} className="p-2 text-neutral/40 transition-colors hover:text-secondary" title="Edit"><Pencil size={16} /></button>
          <button onClick={handleDelete} className="p-2 text-neutral/40 transition-colors hover:text-error" title="Delete"><Trash2 size={16} /></button>
        </div>
      </div>

      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={item.title}>
        <ProductDetailView item={item} onClose={() => setShowDetail(false)} onEdit={handleEdit} />
      </Modal>
    </>
  );
};

/* ─── Product Detail View inside Modal ─── */
const ProductDetailView = ({ item, onClose, onEdit }) => {
  const [activeImg, setActiveImg] = useState(0);
  const images = (item.images || []).map((img) => img?.url || img).filter(Boolean);
  const isDiscounted = item.isPromo && item.discountedPrice != null && item.discountedPrice < item.price;

  return (
    <div className="space-y-5">
      {/* Image gallery */}
      {images.length > 0 && (
        <div>
          <div className="aspect-video w-full overflow-hidden bg-base-200">
            <img src={images[activeImg]} alt={item.title} className="h-full w-full object-contain" />
          </div>
          {images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`h-14 w-14 flex-shrink-0 overflow-hidden border-2 transition-colors ${i === activeImg ? 'border-secondary' : 'border-base-300'}`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap gap-2">
        <Badge variant={item.sold ? 'error' : 'success'}>{item.sold ? 'Sold' : 'Available'}</Badge>
        {item.category && <Badge variant="info">{item.category}</Badge>}
        {item.style && <Badge variant="secondary">{item.style}</Badge>}
        {item.isBestSeller && <Badge variant="warning">Best Seller</Badge>}
        {item.isPromo && <Badge variant="error">Promo</Badge>}
      </div>

      {/* Price */}
      <div>
        {isDiscounted ? (
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-bold text-error">{formatPrice(item.discountedPrice)}</span>
            <span className="text-sm text-neutral/40 line-through">{formatPrice(item.price)}</span>
            <span className="text-xs font-semibold text-success">
              {(((item.price - item.discountedPrice) / item.price) * 100).toFixed(0)}% OFF
            </span>
          </div>
        ) : (
          <span className="text-xl font-bold text-neutral">{formatPrice(item.price)}</span>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {item.items && <Detail label="Items" value={item.items} />}
        {item.leadTime && <Detail label="Lead Time" value={`${item.leadTime} days`} />}
        {item.shippingDays && <Detail label="Shipping" value={`${item.shippingDays} days`} />}
        {item.isForeign && item.origin && <Detail label="Origin" value={item.origin} />}
      </div>

      {/* Description */}
      {item.description && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral/40">Description</p>
          <div className="prose prose-sm max-h-40 overflow-y-auto text-neutral/70" dangerouslySetInnerHTML={{ __html: item.description }} />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 border-t border-base-300 pt-4">
        <button onClick={onEdit} className="btn btn-primary flex-1 rounded-none text-sm">Edit Product</button>
        <button onClick={onClose} className="btn btn-ghost flex-1 rounded-none border border-base-300 text-sm">Close</button>
      </div>
    </div>
  );
};

const Detail = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral/40">{label}</p>
    <p className="mt-0.5 font-medium text-neutral">{value}</p>
  </div>
);

export default AdminProductListCard;
