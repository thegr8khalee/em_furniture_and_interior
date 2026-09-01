import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Megaphone } from 'lucide-react';
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

const MarketingManagement = () => {
  const [activeTab, setActiveTab] = useState('banners');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bannerForm, setBannerForm] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    linkUrl: '',
    position: 'home',
    priority: 0,
    isActive: true,
    startDate: '',
    endDate: '',
  });

  const [flashSaleForm, setFlashSaleForm] = useState({
    name: '',
    description: '',
    discountType: 'percentage',
    discountValue: 0,
    productIds: '',
    collectionIds: '',
    bannerImageUrl: '',
    isActive: true,
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchItems();
  }, [activeTab]);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const endpoint =
        activeTab === 'banners'
          ? '/marketing/admin/banners'
          : '/marketing/admin/flash-sales';
      const response = await axiosInstance.get(endpoint);
      setItems(
        activeTab === 'banners' ? response.data.banners : response.data.flashSales
      );
    } catch (error) {
      toast.error(`Failed to load ${activeTab}`);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetBannerForm = () => {
    setBannerForm({
      title: '',
      subtitle: '',
      imageUrl: '',
      linkUrl: '',
      position: 'home',
      priority: 0,
      isActive: true,
      startDate: '',
      endDate: '',
    });
    setEditingItem(null);
  };

  const resetFlashSaleForm = () => {
    setFlashSaleForm({
      name: '',
      description: '',
      discountType: 'percentage',
      discountValue: 0,
      productIds: '',
      collectionIds: '',
      bannerImageUrl: '',
      isActive: true,
      startDate: '',
      endDate: '',
    });
    setEditingItem(null);
  };

  const openCreateModal = () => {
    if (activeTab === 'banners') {
      resetBannerForm();
    } else {
      resetFlashSaleForm();
    }
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    if (activeTab === 'banners') {
      setBannerForm({
        title: item.title,
        subtitle: item.subtitle || '',
        imageUrl: item.imageUrl,
        linkUrl: item.linkUrl || '',
        position: item.position,
        priority: item.priority || 0,
        isActive: item.isActive,
        startDate: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : '',
        endDate: item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : '',
      });
    } else {
      setFlashSaleForm({
        name: item.name,
        description: item.description || '',
        discountType: item.discountType,
        discountValue: item.discountValue,
        productIds: (item.productIds || []).join(', '),
        collectionIds: (item.collectionIds || []).join(', '),
        bannerImageUrl: item.bannerImageUrl || '',
        isActive: item.isActive,
        startDate: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : '',
        endDate: item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : '',
      });
    }
    setShowModal(true);
  };

  const handleBannerSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingItem) {
        await axiosInstance.put(`/marketing/admin/banners/${editingItem._id}`, bannerForm);
        toast.success('Banner updated successfully');
      } else {
        await axiosInstance.post('/marketing/admin/banners', bannerForm);
        toast.success('Banner created successfully');
      }
      setShowModal(false);
      resetBannerForm();
      fetchItems();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save banner');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFlashSaleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const payload = {
      ...flashSaleForm,
      productIds: flashSaleForm.productIds
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id),
      collectionIds: flashSaleForm.collectionIds
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id),
    };
    try {
      if (editingItem) {
        await axiosInstance.put(`/marketing/admin/flash-sales/${editingItem._id}`, payload);
        toast.success('Flash sale updated successfully');
      } else {
        await axiosInstance.post('/marketing/admin/flash-sales', payload);
        toast.success('Flash sale created successfully');
      }
      setShowModal(false);
      resetFlashSaleForm();
      fetchItems();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save flash sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm(`Are you sure you want to delete this ${activeTab === 'banners' ? 'banner' : 'flash sale'}?`))
      return;

    try {
      const endpoint =
        activeTab === 'banners'
          ? `/marketing/admin/banners/${itemId}`
          : `/marketing/admin/flash-sales/${itemId}`;
      await axiosInstance.delete(endpoint);
      toast.success('Deleted successfully');
      fetchItems();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const filteredItems = items.filter((item) => {
    const name = activeTab === 'banners' ? item.title : item.name;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <AdminPageShell
      title="Marketing Management"
      subtitle="Manage promo banners and flash sales"
      actions={
        <Button variant="primary" leftIcon={Plus} onClick={openCreateModal}>
          Create {activeTab === 'banners' ? 'Banner' : 'Flash Sale'}
        </Button>
      }
    >

      <div className="flex border-b border-base-300">
        <button
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'banners' ? 'border-b-2 border-secondary text-secondary' : 'text-neutral/60 hover:text-neutral'}`}
          onClick={() => setActiveTab('banners')}
        >
          Promo Banners
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'flash-sales' ? 'border-b-2 border-secondary text-secondary' : 'text-neutral/60 hover:text-neutral'}`}
          onClick={() => setActiveTab('flash-sales')}
        >
          Flash Sales
        </button>
      </div>

      <Input
        name="search"
        placeholder="Search..."
        icon={Search}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredItems.length === 0 ? (
            <EmptyState icon={Megaphone} title={`No ${activeTab} found`} description="Create one to get started." />
          ) : (
            filteredItems.map((item) => (
              <div key={item._id} className="border border-base-300 bg-white p-5">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h2 className="font-heading text-lg font-semibold text-neutral">
                      {activeTab === 'banners' ? item.title : item.name}
                    </h2>
                    <p className="text-sm text-neutral/60 mt-1">
                      {activeTab === 'banners' ? item.subtitle : item.description}
                    </p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge variant={item.isActive ? 'success' : 'error'}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {activeTab === 'flash-sales' && (
                        <Badge variant="info">
                          {item.discountType === 'percentage' ? `${item.discountValue}%` : `₦${item.discountValue}`}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" leftIcon={Edit2} onClick={() => openEditModal(item)}>Edit</Button>
                    <Button variant="danger" size="sm" leftIcon={Trash2} onClick={() => handleDelete(item._id)}>Delete</Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={`${editingItem ? 'Edit' : 'Create'} ${activeTab === 'banners' ? 'Banner' : 'Flash Sale'}`}>
        <form onSubmit={activeTab === 'banners' ? handleBannerSubmit : handleFlashSaleSubmit} className="space-y-4">
          {activeTab === 'banners' ? (
            <>
              <Input label="Title" value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} required />
              <Input label="Subtitle" value={bannerForm.subtitle} onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })} />
              <Input label="Image URL" value={bannerForm.imageUrl} onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })} required />
              <Input label="Link URL" value={bannerForm.linkUrl} onChange={(e) => setBannerForm({ ...bannerForm, linkUrl: e.target.value })} />

              <Select label="Position" value={bannerForm.position} onChange={(e) => setBannerForm({ ...bannerForm, position: e.target.value })}>
                <option value="home">Home</option>
                <option value="shop">Shop</option>
                <option value="collection">Collection</option>
                <option value="product">Product</option>
              </Select>

              <Input label="Priority" type="number" value={bannerForm.priority} onChange={(e) => setBannerForm({ ...bannerForm, priority: parseInt(e.target.value, 10) || 0 })} />

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="toggle toggle-sm" checked={bannerForm.isActive} onChange={(e) => setBannerForm({ ...bannerForm, isActive: e.target.checked })} />
                <span className="text-sm text-neutral">Active</span>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <Input label="Start Date" type="date" value={bannerForm.startDate} onChange={(e) => setBannerForm({ ...bannerForm, startDate: e.target.value })} />
                <Input label="End Date" type="date" value={bannerForm.endDate} onChange={(e) => setBannerForm({ ...bannerForm, endDate: e.target.value })} />
              </div>
            </>
          ) : (
            <>
              <Input label="Name" value={flashSaleForm.name} onChange={(e) => setFlashSaleForm({ ...flashSaleForm, name: e.target.value })} required />

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Description</label>
                <textarea className="w-full border border-base-300 bg-white px-4 py-3 text-sm text-neutral transition-colors duration-300 placeholder:text-neutral/40 focus:border-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30" value={flashSaleForm.description} onChange={(e) => setFlashSaleForm({ ...flashSaleForm, description: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select label="Discount Type" value={flashSaleForm.discountType} onChange={(e) => setFlashSaleForm({ ...flashSaleForm, discountType: e.target.value })}>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed</option>
                </Select>
                <Input label="Discount Value" type="number" value={flashSaleForm.discountValue} onChange={(e) => setFlashSaleForm({ ...flashSaleForm, discountValue: parseFloat(e.target.value) })} required />
              </div>

              <Input label="Product IDs (comma separated)" value={flashSaleForm.productIds} onChange={(e) => setFlashSaleForm({ ...flashSaleForm, productIds: e.target.value })} />
              <Input label="Collection IDs (comma separated)" value={flashSaleForm.collectionIds} onChange={(e) => setFlashSaleForm({ ...flashSaleForm, collectionIds: e.target.value })} />
              <Input label="Banner Image URL" value={flashSaleForm.bannerImageUrl} onChange={(e) => setFlashSaleForm({ ...flashSaleForm, bannerImageUrl: e.target.value })} />

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="toggle toggle-sm" checked={flashSaleForm.isActive} onChange={(e) => setFlashSaleForm({ ...flashSaleForm, isActive: e.target.checked })} />
                <span className="text-sm text-neutral">Active</span>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <Input label="Start Date" type="date" value={flashSaleForm.startDate} onChange={(e) => setFlashSaleForm({ ...flashSaleForm, startDate: e.target.value })} required />
                <Input label="End Date" type="date" value={flashSaleForm.endDate} onChange={(e) => setFlashSaleForm({ ...flashSaleForm, endDate: e.target.value })} required />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>{editingItem ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </AdminPageShell>
  );
};

export default MarketingManagement;
