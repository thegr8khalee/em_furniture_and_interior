import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Trash2, Star, Gift, Tag } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAdminStore } from '../../store/useAdminStore';
import { useCollectionStore } from '../../store/useCollectionStore';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';

const formatPrice = (val) =>
  '₦' + Number(val).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AdminCollectionListCard = ({ item, viewMode = 'grid' }) => {
  const [showDetail, setShowDetail] = useState(false);
  const { delCollection } = useAdminStore();
  const { getCollections } = useCollectionStore();
  const navigate = useNavigate();

  const handleEdit = () => navigate(`/admin/collections/edit/${item._id}`);

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this collection and unassign its products?')) {
      delCollection(item._id)
        .then(() => {
          toast.success('Collection deleted successfully!');
          getCollections(1, 12, {}, false);
        })
        .catch(() => toast.error('Failed to delete collection.'));
    }
  };

  const isDiscounted = item.isPromo && item.discountedPrice && item.discountedPrice < item.price;
  const displayPrice = isDiscounted ? item.discountedPrice : item.price;
  const imgSrc = item.coverImage?.url || '';

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
          {/* Product count */}
          <div className="absolute right-2 top-2 z-10">
            <span className="bg-primary/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              {item.productIds?.length || 0} Items
            </span>
          </div>
          {/* Image */}
          <div className="relative aspect-[4/3] overflow-hidden bg-base-200">
            {imgSrc ? (
              <img src={imgSrc} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
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
            <div className="flex items-center gap-2">
              <Tag size={10} className="text-neutral/30" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral/40">{item.style || 'No style'}</p>
            </div>
            <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-neutral">{item.name}</h3>
            {/* Rating */}
            <div className="mt-1 flex items-center gap-1">
              <Star size={12} className="fill-yellow-500 text-yellow-500" />
              <span className="text-xs text-neutral/50">{item.averageRating || 0} ({item.reviews?.length || 0})</span>
            </div>
            <div className="mt-auto pt-2">
              {isDiscounted ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold text-error">{formatPrice(displayPrice)}</span>
                  <span className="text-xs text-neutral/40 line-through">{formatPrice(item.price)}</span>
                </div>
              ) : (
                <span className="text-base font-bold text-neutral">{formatPrice(item.price)}</span>
              )}
            </div>
          </div>
        </div>

        <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={item.name}>
          <CollectionDetailView item={item} onClose={() => setShowDetail(false)} onEdit={handleEdit} />
        </Modal>
      </>
    );
  }

  /* ─── List row ─── */
  return (
    <>
      <div className="group flex items-center gap-4 border border-base-300 bg-white p-3 transition-shadow hover:shadow-md">
        <div className="relative h-16 w-20 flex-shrink-0 overflow-hidden bg-base-200">
          {imgSrc ? (
            <img src={imgSrc} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-neutral/20">No img</div>
          )}
          {item.isBestSeller && (
            <span className="absolute left-0 top-0 bg-secondary px-1 py-px text-[8px] font-bold text-white">BS</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-sm font-semibold text-neutral">{item.name}</h3>
          <div className="flex items-center gap-3 text-xs text-neutral/50">
            <span>{item.style}</span>
            <span>{item.productIds?.length || 0} products</span>
            <span className="flex items-center gap-0.5"><Star size={10} className="fill-yellow-500 text-yellow-500" />{item.averageRating || 0}</span>
          </div>
        </div>
        <div className="hidden sm:block">
          {isDiscounted ? (
            <div className="text-right">
              <span className="text-sm font-bold text-error">{formatPrice(displayPrice)}</span>
              <span className="ml-2 text-xs text-neutral/40 line-through">{formatPrice(item.price)}</span>
            </div>
          ) : (
            <span className="text-sm font-bold text-neutral">{formatPrice(item.price)}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowDetail(true)} className="p-2 text-neutral/40 transition-colors hover:text-primary" title="View"><Eye size={16} /></button>
          <button onClick={handleEdit} className="p-2 text-neutral/40 transition-colors hover:text-secondary" title="Edit"><Pencil size={16} /></button>
          <button onClick={handleDelete} className="p-2 text-neutral/40 transition-colors hover:text-error" title="Delete"><Trash2 size={16} /></button>
        </div>
      </div>

      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={item.name}>
        <CollectionDetailView item={item} onClose={() => setShowDetail(false)} onEdit={handleEdit} />
      </Modal>
    </>
  );
};

/* ─── Collection Detail View inside Modal ─── */
const CollectionDetailView = ({ item, onClose, onEdit }) => {
  const imgSrc = item.coverImage?.url || '';
  const isDiscounted = item.isPromo && item.discountedPrice && item.discountedPrice < item.price;

  return (
    <div className="space-y-5">
      {/* Cover image */}
      {imgSrc && (
        <div className="aspect-video w-full overflow-hidden bg-base-200">
          <img src={imgSrc} alt={item.name} className="h-full w-full object-cover" />
        </div>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap gap-2">
        {item.style && <Badge variant="secondary">{item.style}</Badge>}
        {item.isBestSeller && <Badge variant="warning">Best Seller</Badge>}
        {item.isPromo && <Badge variant="error">Promo</Badge>}
        <Badge variant="info">{item.productIds?.length || 0} Products</Badge>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={16}
              className={star <= Math.round(item.averageRating || 0) ? 'fill-yellow-500 text-yellow-500' : 'text-neutral/20'}
            />
          ))}
        </div>
        <span className="text-sm text-neutral/50">{item.averageRating || 0} ({item.reviews?.length || 0} reviews)</span>
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

      {/* Description */}
      {item.description && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral/40">Description</p>
          <div className="prose prose-sm max-h-40 overflow-y-auto text-neutral/70" dangerouslySetInnerHTML={{ __html: item.description }} />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 border-t border-base-300 pt-4">
        <button onClick={onEdit} className="btn btn-primary flex-1 rounded-none text-sm">Edit Collection</button>
        <button onClick={onClose} className="btn btn-ghost flex-1 rounded-none border border-base-300 text-sm">Close</button>
      </div>
    </div>
  );
};

export default AdminCollectionListCard;
