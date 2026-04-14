import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Trash2, MapPin, Tag } from 'lucide-react';
import { useAdminStore } from '../../store/useAdminStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';

const formatPrice = (val) =>
  '₦' + Number(val).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const AdminProjectListCard = ({ item, viewMode = 'grid' }) => {
  const [showDetail, setShowDetail] = useState(false);
  const { delProject } = useAdminStore();
  const { fetchProjects } = useProjectsStore();
  const navigate = useNavigate();

  const handleEdit = () => navigate(`/admin/editProject/${item._id}`);

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      delProject(item._id).then(() => fetchProjects(1, 10));
    }
  };

  const imgSrc = item.images?.[0]?.url || item.images?.[0] || '';

  /* ─── Grid card ─── */
  if (viewMode === 'grid') {
    return (
      <>
        <div className="group relative flex flex-col border border-base-300 bg-white transition-shadow hover:shadow-lg">
          {/* Category badge */}
          <div className="absolute left-2 top-2 z-10">
            {item.category && (
              <span className="bg-info/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">{item.category}</span>
            )}
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
            <h3 className="line-clamp-1 text-sm font-semibold text-neutral">{item.title}</h3>
            <div className="mt-1 flex items-center gap-1 text-xs text-neutral/50">
              <MapPin size={11} className="text-neutral/30" />
              <span className="truncate">{item.location || 'No location'}</span>
            </div>
            <div className="mt-auto pt-2">
              <span className="text-base font-bold text-neutral">{formatPrice(item.price)}</span>
            </div>
          </div>
        </div>

        <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={item.title}>
          <ProjectDetailView item={item} onClose={() => setShowDetail(false)} onEdit={handleEdit} />
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
          <div className="flex items-center gap-3 text-xs text-neutral/50">
            <span className="flex items-center gap-0.5"><MapPin size={10} />{item.location}</span>
            <span className="flex items-center gap-0.5"><Tag size={10} />{item.category}</span>
          </div>
        </div>
        <div className="hidden sm:block">
          <span className="text-sm font-bold text-neutral">{formatPrice(item.price)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowDetail(true)} className="p-2 text-neutral/40 transition-colors hover:text-primary" title="View"><Eye size={16} /></button>
          <button onClick={handleEdit} className="p-2 text-neutral/40 transition-colors hover:text-secondary" title="Edit"><Pencil size={16} /></button>
          <button onClick={handleDelete} className="p-2 text-neutral/40 transition-colors hover:text-error" title="Delete"><Trash2 size={16} /></button>
        </div>
      </div>

      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={item.title}>
        <ProjectDetailView item={item} onClose={() => setShowDetail(false)} onEdit={handleEdit} />
      </Modal>
    </>
  );
};

/* ─── Project Detail View inside Modal ─── */
const ProjectDetailView = ({ item, onClose, onEdit }) => {
  const [activeImg, setActiveImg] = useState(0);
  const images = (item.images || []).map((img) => img?.url || img).filter(Boolean);

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
        {item.category && <Badge variant="info">{item.category}</Badge>}
        {item.location && <Badge variant="neutral">{item.location}</Badge>}
      </div>

      {/* Budget */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral/40">Budget</p>
        <span className="text-xl font-bold text-neutral">{formatPrice(item.price)}</span>
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
        <button onClick={onEdit} className="btn btn-primary flex-1 rounded-none text-sm">Edit Project</button>
        <button onClick={onClose} className="btn btn-ghost flex-1 rounded-none border border-base-300 text-sm">Close</button>
      </div>
    </div>
  );
};

export default AdminProjectListCard;
