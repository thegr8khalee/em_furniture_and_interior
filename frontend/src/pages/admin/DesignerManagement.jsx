import React, { useEffect, useState } from 'react';
import { axiosInstance } from '../../lib/axios';
import { Loader2, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonBlock } from '../../components/ui/Skeleton';

const DesignerManagement = () => {
  const [designers, setDesigners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    bio: '',
    isActive: true,
  });
  const [avatar, setAvatar] = useState(null);

  const fetchDesigners = async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get('/designers/admin');
      setDesigners(res.data.designers || []);
    } catch (error) {
      toast.error('Failed to load designers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDesigners();
  }, []);

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const encoded = await toBase64(file);
    setAvatar(encoded);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Designer name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await axiosInstance.post('/designers/admin', {
        ...formData,
        avatar,
      });
      toast.success('Designer added');
      setFormData({ name: '', title: '', bio: '', isActive: true });
      setAvatar(null);
      fetchDesigners();
    } catch (error) {
      toast.error('Failed to add designer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (designer) => {
    try {
      await axiosInstance.put(`/designers/admin/${designer._id}`, {
        isActive: !designer.isActive,
      });
      fetchDesigners();
    } catch (error) {
      toast.error('Failed to update designer');
    }
  };

  const handleDelete = async (designerId) => {
    if (!window.confirm('Delete this designer?')) return;
    try {
      await axiosInstance.delete(`/designers/admin/${designerId}`);
      toast.success('Designer deleted');
      fetchDesigners();
    } catch (error) {
      toast.error('Failed to delete designer');
    }
  };

  return (
    <AdminPageShell
      title="Designers"
      subtitle="Manage available designers"
    >

      <div className="border border-base-300 p-6 bg-white">
        <h2 className="font-heading text-lg font-semibold mb-4">Add Designer</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Name" name="name" value={formData.name} onChange={handleChange} required />
            <Input label="Title" name="title" value={formData.title} onChange={handleChange} />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Bio</label>
            <textarea name="bio" className="w-full border border-base-300 bg-white px-4 py-3 text-sm text-neutral transition-colors duration-300 placeholder:text-neutral/40 focus:border-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30" rows={3} value={formData.bio} onChange={handleChange} />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Avatar</label>
            <input type="file" accept="image/*" className="file-input file-input-bordered w-full" onChange={handleAvatarChange} />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="isActive" className="checkbox checkbox-sm" checked={formData.isActive} onChange={handleChange} />
            <span className="text-sm text-neutral">Active</span>
          </label>

          <Button type="submit" variant="primary" leftIcon={Plus} isLoading={isSubmitting}>
            Add Designer
          </Button>
        </form>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-20 w-full" />)}
        </div>
      ) : designers.length === 0 ? (
        <EmptyState icon={Users} title="No designers" description="Add your first designer above." />
      ) : (
        <div className="grid gap-4">
          {designers.map((designer) => (
            <div key={designer._id} className="border border-base-300 p-4 bg-white flex items-center justify-between">
              <div>
                <div className="font-semibold text-neutral">{designer.name}</div>
                <div className="text-sm text-neutral/60">{designer.title}</div>
                <Badge variant={designer.isActive ? 'success' : 'neutral'} className="mt-1">
                  {designer.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleToggleActive(designer)}>
                  {designer.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button variant="danger" size="sm" leftIcon={Trash2} onClick={() => handleDelete(designer._id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPageShell>
  );
};

export default DesignerManagement;
