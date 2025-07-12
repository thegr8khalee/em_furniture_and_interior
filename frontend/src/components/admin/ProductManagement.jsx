// src/components/Admin/ProductManagement.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProductsStore } from '../../store/useProductsStore';
import { Loader2, Pen, PenIcon, Trash2 } from 'lucide-react';
import { useAdminStore } from '../../store/useAdminStore';
// import axiosInstance from '../../utils/axiosInstance'; // For API calls
// import { toast } from 'react-toastify'; // For notifications

const ProductManagement = () => {
  // const [loading, setLoading] = useState(false);
  // const [error, setError] = useState(null);

  const { products, getProducts, isGettingProducts } = useProductsStore();
  const { isDeletingProduct, delProduct } = useAdminStore();

  useEffect(() => {
    getProducts();
  }, [getProducts]);

  const navigate = useNavigate();

  const handleAddProduct = () => {
    navigate('/admin/products/new');
  };

  const handleEditProduct = (product) => {
    console.log(product);
    navigate(`/admin/products/edit/${product}`);
  };

  const handleDeleteProduct = async (productId) => {
        // NEW: Add a confirmation prompt before deleting
        if (window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
            const success = await delProduct(productId);
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

  if (isGettingProducts) {
    // Show a loading indicator while authentication status is being determined
    return <div className="text-center p-4">Loading Data...</div>;
  }

  return (
    <div>
      <h2 className="text-3xl font-semibold mb-6 text-secondary font-[poppins]">
        Manage Products
      </h2>
      <button
        className="w-full btn btn-primary mb-6 text-secondary border-0 shadow-0 rounded-md"
        onClick={handleAddProduct}
      >
        Add New Product
      </button>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product._id}>
                <td>{product.name}</td>
                <td>{product.category}</td>
                <td>₦{product.price.toFixed(2)}</td>
                <td className="space-y-1 sm:flex">
                  <button
                    className="btn btn-circle btn-warning mr-2"
                    onClick={() => handleEditProduct(product._id)}
                  >
                    <Pen />
                  </button>
                  <button
                    className="btn btn-circle btn-error"
                    onClick={() => handleDeleteProduct(product._id)}
                  >
                    {isDeletingProduct ? (
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

export default ProductManagement;
