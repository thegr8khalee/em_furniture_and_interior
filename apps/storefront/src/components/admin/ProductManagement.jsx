// src/components/Admin/ProductManagement.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProductsStore } from '../../store/useProductsStore';
import { Loader2, Package, Search, Plus, LayoutGrid, List } from 'lucide-react';
import AdminProductListCard from './ProductList';
import Button from '../ui/Button';
import Pagination from '../ui/Pagination';
import EmptyState from '../ui/EmptyState';

const CATEGORIES = ['All', 'Living Room', 'Armchair', 'Bedroom', 'Dining', 'Office', 'Outdoor', 'Kids', 'Storage'];

const ProductManagement = () => {
  const {
    products,
    getProducts,
    isGettingProducts,
    getProductsCount,
    productsCount,
    resetProducts
  } = useProductsStore();

  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [viewMode, setViewMode] = useState('grid');
  const itemsPerPage = 12;

  const buildFilters = useCallback(() => {
    const filters = {};
    if (searchTerm.trim()) filters.search = searchTerm.trim();
    if (categoryFilter !== 'All') filters.category = categoryFilter;
    return filters;
  }, [searchTerm, categoryFilter]);

  useEffect(() => {
    getProductsCount();
    getProducts(1, itemsPerPage, {}, false);
  }, [getProducts, getProductsCount, itemsPerPage]);

  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    setCurrentPage(newPage);
    resetProducts();
    getProducts(newPage, itemsPerPage, buildFilters(), false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    resetProducts();
    getProducts(1, itemsPerPage, buildFilters(), false);
  };

  const handleCategoryChange = (cat) => {
    setCategoryFilter(cat);
    setCurrentPage(1);
    resetProducts();
    const filters = {};
    if (searchTerm.trim()) filters.search = searchTerm.trim();
    if (cat !== 'All') filters.category = cat;
    getProducts(1, itemsPerPage, filters, false);
  };

  const totalPages = productsCount ? Math.ceil(productsCount / itemsPerPage) : 0;
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, productsCount || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-neutral">Products</h2>
          <p className="mt-1 text-sm text-neutral/50">
            {productsCount != null ? `${productsCount} total products` : 'Loading...'}
          </p>
        </div>
        <Button variant="primary" leftIcon={Plus} onClick={() => navigate('/admin/products/new')}>
          Add Product
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 border border-base-300 bg-white p-4 sm:flex-row sm:items-center">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral/40" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-base-300 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral placeholder:text-neutral/40 focus:border-secondary focus:outline-none"
          />
        </form>
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="border border-base-300 bg-white px-3 py-2.5 text-sm text-neutral focus:border-secondary focus:outline-none"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
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
      {productsCount != null && products.length > 0 && (
        <p className="text-xs font-medium uppercase tracking-wider text-neutral/40">
          Showing {startItem}–{endItem} of {productsCount}
        </p>
      )}

      {/* Loading */}
      {isGettingProducts && products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="mb-3 animate-spin text-secondary" size={32} />
          <span className="text-sm text-neutral/50">Loading products...</span>
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description={searchTerm || categoryFilter !== 'All' ? 'Try adjusting your search or filters.' : 'Create your first product to get started.'}
          actionLabel="Add Product"
          onAction={() => navigate('/admin/products/new')}
        />
      ) : (
        <>
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'space-y-3'
          }>
            {products.map((product) => (
              <AdminProductListCard key={product._id} item={product} viewMode={viewMode} />
            ))}
          </div>
          {isGettingProducts && (
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

export default ProductManagement;