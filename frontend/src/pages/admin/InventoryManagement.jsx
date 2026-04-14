import React, { useState, useEffect } from 'react';
import { Package, Search, AlertTriangle, Edit2, Loader2 } from 'lucide-react';
import { axiosInstance } from '../../lib/axios';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { SkeletonBlock } from '../../components/ui/Skeleton';

const InventoryManagement = () => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustmentForm, setAdjustmentForm] = useState({
    delta: '',
    newQuantity: '',
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [currentPage, searchQuery, lowStockOnly]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
      });
      if (searchQuery) params.append('search', searchQuery);
      if (lowStockOnly) params.append('lowStock', 'true');

      const response = await axiosInstance.get(`/inventory/admin/products?${params}`);
      setProducts(response.data.products);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      toast.error('Failed to load inventory');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const openAdjustModal = (product) => {
    setSelectedProduct(product);
    setAdjustmentForm({
      delta: '',
      newQuantity: product.stockQuantity || 0,
      reason: '',
    });
    setShowAdjustModal(true);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axiosInstance.put(`/inventory/admin/products/${selectedProduct._id}/adjust`, {
        newQuantity: parseInt(adjustmentForm.newQuantity, 10),
        reason: adjustmentForm.reason,
      });
      toast.success('Inventory updated successfully');
      setShowAdjustModal(false);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update inventory');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products;

  return (
    <AdminPageShell
      title="Inventory Management"
      subtitle="Manage stock levels and warehouse locations"
    >

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Input
            name="search"
            placeholder="Search by name or SKU..."
            icon={Search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          />
          <span className="text-sm text-neutral">Low stock only</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-14 w-full" />)}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Stock</th>
                  <th>Threshold</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <EmptyState icon={Package} title="No products found" description="Try adjusting your search or filters." />
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const isLow = (product.stockQuantity || 0) <= (product.lowStockThreshold || 5);
                    return (
                      <tr key={product._id}>
                        <td>
                          <div className="flex items-center gap-2">
                            {isLow && <AlertTriangle size={16} className="text-warning" />}
                            <span className="font-medium">{product.name}</span>
                          </div>
                        </td>
                        <td>{product.sku || '-'}</td>
                        <td>
                          <Badge variant={isLow ? 'warning' : 'success'}>
                            {product.stockQuantity || 0}
                          </Badge>
                        </td>
                        <td>{product.lowStockThreshold || 5}</td>
                        <td>{product.warehouseLocation || '-'}</td>
                        <td>
                          <Button variant="ghost" size="sm" leftIcon={Edit2} onClick={() => openAdjustModal(product)}>
                            Adjust
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          )}
        </>
      )}

      <Modal isOpen={showAdjustModal && !!selectedProduct} onClose={() => setShowAdjustModal(false)} title={`Adjust Inventory: ${selectedProduct?.name || ''}`}>
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          <Input
            label="New Stock Quantity"
            type="number"
            value={adjustmentForm.newQuantity}
            onChange={(e) => setAdjustmentForm({ ...adjustmentForm, newQuantity: e.target.value })}
            required
          />

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Reason (optional)</label>
            <textarea
              className="w-full border border-base-300 bg-white px-4 py-3 text-sm text-neutral transition-colors duration-300 placeholder:text-neutral/40 focus:border-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30"
              value={adjustmentForm.reason}
              onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
              placeholder="e.g., Restocked from supplier"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowAdjustModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>Update</Button>
          </div>
        </form>
      </Modal>
    </AdminPageShell>
  );
};

export default InventoryManagement;
