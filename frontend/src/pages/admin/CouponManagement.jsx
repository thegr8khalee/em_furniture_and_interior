import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Tag, Calendar, DollarSign, ShoppingBag, Loader2 } from 'lucide-react';
import { axiosInstance } from '../../lib/axios';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import { SkeletonBlock } from '../../components/ui/Skeleton';

const CouponManagement = () => {
  const [coupons, setCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'expired', 'inactive'
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: 0,
    minimumPurchase: 0,
    maximumDiscount: 0,
    validFrom: '',
    validUntil: '',
    usageLimit: 0,
    isActive: true,
    applicableCategories: [],
    applicableProductIds: [],
    applicableCollectionIds: [],
    excludedProductIds: [],
    excludedCollectionIds: []
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get('/coupons/admin');
      setCoupons(response.data.coupons || []);
    } catch (error) {
      toast.error('Failed to load coupons');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleArrayInput = (e, fieldName) => {
    const value = e.target.value;
    const array = value.split(',').map(item => item.trim()).filter(item => item !== '');
    setFormData(prev => ({
      ...prev,
      [fieldName]: array
    }));
  };

  const resetForm = () => {
    setFormData({
      code: '',
      discountType: 'percentage',
      discountValue: 0,
      minimumPurchase: 0,
      maximumDiscount: 0,
      validFrom: '',
      validUntil: '',
      usageLimit: 0,
      isActive: true,
      applicableCategories: [],
      applicableProductIds: [],
      applicableCollectionIds: [],
      excludedProductIds: [],
      excludedCollectionIds: []
    });
    setEditingCoupon(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minimumPurchase: coupon.minimumPurchase || 0,
      maximumDiscount: coupon.maximumDiscount || 0,
      validFrom: coupon.validFrom ? new Date(coupon.validFrom).toISOString().split('T')[0] : '',
      validUntil: coupon.validUntil ? new Date(coupon.validUntil).toISOString().split('T')[0] : '',
      usageLimit: coupon.usageLimit || 0,
      isActive: coupon.isActive,
      applicableCategories: coupon.applicableCategories || [],
      applicableProductIds: coupon.applicableProductIds || [],
      applicableCollectionIds: coupon.applicableCollectionIds || [],
      excludedProductIds: coupon.excludedProductIds || [],
      excludedCollectionIds: coupon.excludedCollectionIds || []
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingCoupon) {
        await axiosInstance.put(`/coupons/admin/${editingCoupon._id}`, formData);
        toast.success('Coupon updated successfully');
      } else {
        await axiosInstance.post('/coupons/admin/create', formData);
        toast.success('Coupon created successfully');
      }
      setShowModal(false);
      resetForm();
      fetchCoupons();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save coupon');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (couponId) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;

    try {
      await axiosInstance.delete(`/coupons/admin/${couponId}`);
      toast.success('Coupon deleted successfully');
      fetchCoupons();
    } catch (error) {
      toast.error('Failed to delete coupon');
    }
  };

  const getCouponStatus = (coupon) => {
    if (!coupon.isActive) return 'inactive';
    if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) return 'expired';
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) return 'exhausted';
    return 'active';
  };

  const filteredCoupons = coupons.filter(coupon => {
    const matchesSearch = coupon.code.toLowerCase().includes(searchQuery.toLowerCase());
    const status = getCouponStatus(coupon);
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'active') return matchesSearch && status === 'active';
    if (filterStatus === 'expired') return matchesSearch && (status === 'expired' || status === 'exhausted');
    if (filterStatus === 'inactive') return matchesSearch && status === 'inactive';
    
    return matchesSearch;
  });

  return (
    <AdminPageShell
      title="Coupon Management"
      subtitle="Create and manage discount coupons"
      actions={
        <Button variant="primary" leftIcon={Plus} onClick={openCreateModal}>
          Create Coupon
        </Button>
      }
    >

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Input
            name="search"
            placeholder="Search by code..."
            icon={Search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-auto"
        >
          <option value="all">All Coupons</option>
          <option value="active">Active</option>
          <option value="expired">Expired/Exhausted</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      {/* Coupons List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredCoupons.length === 0 ? (
            <EmptyState icon={Tag} title="No coupons found" description="Create a new coupon or adjust your filters." />
          ) : (
            filteredCoupons.map((coupon) => {
              const status = getCouponStatus(coupon);
              return (
                <div key={coupon._id} className="card bg-base-100 border border-base-300">
                  <div className="card-body">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-2xl font-bold font-mono">{coupon.code}</h3>
                          <Badge variant={
                            status === 'active' ? 'success' :
                            status === 'expired' || status === 'exhausted' ? 'warning' :
                            'neutral'
                          }>
                            {status}
                          </Badge>
                        </div>
                        
                        <div className="mt-3 flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <DollarSign size={16} className="text-neutral/60" />
                            <span>
                              {coupon.discountType === 'percentage' 
                                ? `${coupon.discountValue}% off`
                                : `₦${coupon.discountValue.toLocaleString()} off`
                              }
                            </span>
                          </div>

                          {coupon.minimumPurchase > 0 && (
                            <div className="flex items-center gap-2">
                              <ShoppingBag size={16} className="text-neutral/60" />
                              <span>Min: ₦{coupon.minimumPurchase.toLocaleString()}</span>
                            </div>
                          )}

                          {coupon.validUntil && (
                            <div className="flex items-center gap-2">
                              <Calendar size={16} className="text-neutral/60" />
                              <span>Valid until: {new Date(coupon.validUntil).toLocaleDateString()}</span>
                            </div>
                          )}

                          {coupon.usageLimit > 0 && (
                            <div className="flex items-center gap-2">
                              <Tag size={16} className="text-neutral/60" />
                              <span>Used: {coupon.usageCount}/{coupon.usageLimit}</span>
                            </div>
                          )}
                        </div>

                        {(coupon.applicableCategories?.length > 0 || 
                          coupon.applicableProductIds?.length > 0 || 
                          coupon.applicableCollectionIds?.length > 0) && (
                          <div className="mt-2 text-xs text-neutral/60">
                            Limited to specific {
                              coupon.applicableCategories?.length > 0 ? 'categories' :
                              coupon.applicableProductIds?.length > 0 ? 'products' :
                              'collections'
                            }
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" leftIcon={Edit2} onClick={() => openEditModal(coupon)}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" leftIcon={Trash2} onClick={() => handleDelete(coupon._id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingCoupon ? 'Edit Coupon' : 'Create New Coupon'} className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Coupon Code" name="code" value={formData.code} onChange={handleInputChange} required disabled={editingCoupon !== null} className="uppercase" />

            <Select label="Discount Type" name="discountType" value={formData.discountType} onChange={handleInputChange} required>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </Select>

            <Input label={`Discount Value ${formData.discountType === 'percentage' ? '(%)' : '(₦)'}`} type="number" name="discountValue" value={formData.discountValue} onChange={handleInputChange} required />
            <Input label="Minimum Purchase (₦)" type="number" name="minimumPurchase" value={formData.minimumPurchase} onChange={handleInputChange} />

            {formData.discountType === 'percentage' && (
              <Input label="Maximum Discount (₦)" type="number" name="maximumDiscount" value={formData.maximumDiscount} onChange={handleInputChange} />
            )}

            <Input label="Usage Limit (0 = unlimited)" type="number" name="usageLimit" value={formData.usageLimit} onChange={handleInputChange} />
            <Input label="Valid From" type="date" name="validFrom" value={formData.validFrom} onChange={handleInputChange} />
            <Input label="Valid Until" type="date" name="validUntil" value={formData.validUntil} onChange={handleInputChange} />
          </div>

          <Input label="Applicable Categories (comma-separated)" placeholder="Living Room, Bedroom, Kitchen" value={formData.applicableCategories.join(', ')} onChange={(e) => handleArrayInput(e, 'applicableCategories')} />

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="isActive" className="checkbox checkbox-sm" checked={formData.isActive} onChange={handleInputChange} />
            <span className="text-sm text-neutral">Active</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => { setShowModal(false); resetForm(); }} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>{editingCoupon ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </AdminPageShell>
  );
};

export default CouponManagement;
