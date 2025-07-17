// src/components/Admin/CollectionManagement.jsx
import React, { useEffect } from 'react';
import { useCollectionStore } from '../../store/useCollectionStore';
import { useAdminStore } from '../../store/useAdminStore';
import { useNavigate } from 'react-router-dom';
import { Loader2, Pen, Trash2 } from 'lucide-react';

const CollectionManagement = () => {
  const { getCollections, collections, isGettingCollections } =
    useCollectionStore();
  const { delCollection, isDeletingCollection } = useAdminStore();

  const navigate = useNavigate();

  useEffect(() => {
    getCollections();
  }, [getCollections]);

  const handleAddCollection = () => {
    navigate('/admin/collections/new');
  };

  const handleEditCollection = async (collection) => {
    navigate(`/admin/collections/edit/${collection}`);
  };

  const handleDeleteCollection = async (collectionId) => {
    if (
      window.confirm(
        'Are you sure you want to delete this product? This action cannot be undone.'
      )
    ) {
      const success = await delCollection(collectionId);
      if (success) {
        // toast.success('Product deleted successfully!'); // Uncomment if using toast
      } else {
        // toast.error(adminError || 'Failed to delete product.'); // Uncomment if using toast
      }
    } else {
      // User cancelled the deletion
      // toast.info('Product deletion cancelled.'); // Optional: inform user
    }
  };

  return (
    <div className="">
      <h2 className="text-3xl font-semibold mb-6 text-secondary font-[poppins]">
        Manage Collections
      </h2>
      <button
        className="w-full btn btn-primary mb-6 rounded-md text-secondary border-none shadow-none"
        onClick={handleAddCollection}
      >
        Add New Collection
      </button>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Price</th>
              <th>Products</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {collections.length === 0 && !isGettingCollections && (
              <tr>
                <td colSpan="4" className="text-center">
                  No collections found.
                </td>
              </tr>
            )}
            {collections.map((collection) => (
              <tr key={collection._id}>
                <td>{collection.name}</td>
                <td>
                  ₦
                  {Number(collection.price).toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td>
                  {collection.productIds ? collection.productIds.length : 0}
                </td>
                <td className="space-y-1 sm:flex">
                  <button
                    className="btn btn-circle btn-warning mr-2"
                    onClick={() => handleEditCollection(collection._id)}
                  >
                    <Pen />
                  </button>
                  <button
                    className="btn btn-circle btn-error"
                    onClick={() => handleDeleteCollection(collection._id)}
                  >
                    {isDeletingCollection ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Trash2 />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CollectionManagement;
