import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, MessageSquare } from 'lucide-react';
import { axiosInstance } from '../../lib/axios';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonBlock } from '../../components/ui/Skeleton';

const ReviewModeration = () => {
  const [pending, setPending] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  const fetchPending = async () => {
    setIsLoading(true);
    try {
      const [productRes, collectionRes] = await Promise.all([
        axiosInstance.get('/review/admin/pending/products'),
        axiosInstance.get('/review/admin/pending/collections'),
      ]);

      const combined = [
        ...(productRes.data.pending || []),
        ...(collectionRes.data.pending || []),
      ];
      setPending(combined);
    } catch (error) {
      toast.error('Failed to load pending reviews');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (item) => {
    try {
      const route =
        item.type === 'Product'
          ? `/review/admin/products/${item.parentId}/reviews/${item.review._id}/approve`
          : `/review/admin/collections/${item.parentId}/reviews/${item.review._id}/approve`;

      await axiosInstance.patch(route);
      toast.success('Review approved');
      fetchPending();
    } catch (error) {
      toast.error('Failed to approve review');
    }
  };

  const handleReject = async (item) => {
    try {
      const route =
        item.type === 'Product'
          ? `/review/admin/products/${item.parentId}/reviews/${item.review._id}`
          : `/review/admin/collections/${item.parentId}/reviews/${item.review._id}`;

      await axiosInstance.delete(route);
      toast.success('Review rejected');
      fetchPending();
    } catch (error) {
      toast.error('Failed to reject review');
    }
  };

  const filtered = pending.filter((item) =>
    filterType === 'all' ? true : item.type.toLowerCase() === filterType
  );

  return (
    <AdminPageShell
      title="Review Moderation"
      subtitle="Approve or reject customer reviews"
      actions={
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-auto"
        >
          <option value="all">All</option>
          <option value="product">Products</option>
          <option value="collection">Collections</option>
        </Select>
      }
    >

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-28 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No pending reviews"
          description="All reviews have been moderated."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => (
            <div key={item.review._id} className="border border-base-300 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <Badge variant={item.type === 'Product' ? 'info' : 'neutral'}>
                    {item.type} Review
                  </Badge>
                  <h3 className="mt-2 text-lg font-semibold text-neutral">
                    {item.parentName}
                  </h3>
                  <p className="text-sm mt-2">Rating: {item.review.rating} / 5</p>
                  {item.review.comment && (
                    <p className="text-sm text-neutral/70 mt-2">{item.review.comment}</p>
                  )}
                  <p className="text-xs text-neutral/50 mt-2">
                    Submitted {new Date(item.review.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" leftIcon={CheckCircle} onClick={() => handleApprove(item)}>
                    Approve
                  </Button>
                  <Button variant="danger" size="sm" leftIcon={XCircle} onClick={() => handleReject(item)}>
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPageShell>
  );
};

export default ReviewModeration;
