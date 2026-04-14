// src/components/Admin/CollectionManagement.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useCollectionStore } from '../../store/useCollectionStore';
import { useNavigate } from 'react-router-dom';
import { Loader2, FolderOpen, Search, Plus, LayoutGrid, List } from 'lucide-react';
import AdminCollectionListCard from './CollectionList';
import Button from '../ui/Button';
import Pagination from '../ui/Pagination';
import EmptyState from '../ui/EmptyState';

const STYLES = ['All', 'Modern', 'Contemporary', 'Antique/Royal', 'Bespoke', 'Minimalist', 'Glam'];

const CollectionManagement = () => {
  const {
    getCollections,
    collections,
    isGettingCollections,
    getCollectionsCount,
    collectionsCount,
    resetCollections
  } = useCollectionStore();

  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [styleFilter, setStyleFilter] = useState('All');
  const [viewMode, setViewMode] = useState('grid');
  const itemsPerPage = 12;

  const buildFilters = useCallback(() => {
    const filters = {};
    if (searchTerm.trim()) filters.search = searchTerm.trim();
    if (styleFilter !== 'All') filters.style = styleFilter;
    return filters;
  }, [searchTerm, styleFilter]);

  useEffect(() => {
    resetCollections();
    getCollectionsCount();
    getCollections(1, itemsPerPage, {}, false);
  }, [getCollections, getCollectionsCount, resetCollections, itemsPerPage]);

  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    setCurrentPage(newPage);
    resetCollections();
    getCollections(newPage, itemsPerPage, buildFilters(), false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    resetCollections();
    getCollections(1, itemsPerPage, buildFilters(), false);
  };

  const handleStyleChange = (style) => {
    setStyleFilter(style);
    setCurrentPage(1);
    resetCollections();
    const filters = {};
    if (searchTerm.trim()) filters.search = searchTerm.trim();
    if (style !== 'All') filters.style = style;
    getCollections(1, itemsPerPage, filters, false);
  };

  const totalPages = collectionsCount ? Math.ceil(collectionsCount / itemsPerPage) : 0;
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, collectionsCount || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-neutral">Collections</h2>
          <p className="mt-1 text-sm text-neutral/50">
            {collectionsCount != null ? `${collectionsCount} total collections` : 'Loading...'}
          </p>
        </div>
        <Button variant="primary" leftIcon={Plus} onClick={() => navigate('/admin/collections/new')}>
          Add Collection
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 border border-base-300 bg-white p-4 sm:flex-row sm:items-center">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral/40" />
          <input
            type="text"
            placeholder="Search collections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-base-300 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral placeholder:text-neutral/40 focus:border-secondary focus:outline-none"
          />
        </form>
        <div className="flex items-center gap-2">
          <select
            value={styleFilter}
            onChange={(e) => handleStyleChange(e.target.value)}
            className="border border-base-300 bg-white px-3 py-2.5 text-sm text-neutral focus:border-secondary focus:outline-none"
          >
            {STYLES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="hidden border-l border-base-300 pl-2 sm:flex">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'text-primary' : 'text-neutral/30 hover:text-neutral/60'}`}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'text-primary' : 'text-neutral/30 hover:text-neutral/60'}`}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Results count */}
      {collectionsCount != null && collections.length > 0 && (
        <p className="text-xs font-medium uppercase tracking-wider text-neutral/40">
          Showing {startItem}–{endItem} of {collectionsCount}
        </p>
      )}

      {/* Loading */}
      {isGettingCollections && collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="mb-3 animate-spin text-secondary" size={32} />
          <span className="text-sm text-neutral/50">Loading collections...</span>
        </div>
      ) : collections.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No collections found"
          description={searchTerm || styleFilter !== 'All' ? 'Try adjusting your search or filters.' : 'Create your first collection to organize products.'}
          actionLabel="Add Collection"
          onAction={() => navigate('/admin/collections/new')}
        />
      ) : (
        <>
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'space-y-3'
          }>
            {collections.map((collection) => (
              <AdminCollectionListCard key={collection._id} item={collection} viewMode={viewMode} />
            ))}
          </div>
          {isGettingCollections && (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-secondary" size={20} />
            </div>
          )}
        </>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
    </div>
  );
};

export default CollectionManagement;