// src/components/Admin/AdminDashboardContent.jsx
import React, { useEffect } from 'react';
import { useProductsStore } from '../../store/useProductsStore';
import { useCollectionStore } from '../../store/useCollectionStore';
import { useNavigate } from 'react-router-dom';
import { useProjectsStore } from '../../store/useProjectsStore';

const AdminDashboardContent = () => {
  // In a real application, you would fetch these stats from your backend
  const { isGettingProducts, productsCount, getProductsCount } =
    useProductsStore();
  const { isGettingCollections, collectionsCount, getCollectionsCount } =
    useCollectionStore();
  const { getProjectsCount, totalCount } = useProjectsStore();

  console.log(collectionsCount);
  useEffect(() => {
    getProductsCount();
    getCollectionsCount();
    getProjectsCount();
  }, [getProductsCount, getCollectionsCount, getProjectsCount]);

  const stats = [
    { label: 'Total Products', value: productsCount },
    { label: 'Total Collections', value: collectionsCount },
    { label: 'Total Projects', value: totalCount },
  ];

  const navigate = useNavigate();

  const handleAddNew = () => {
    navigate('/admin/products/new');
  };

  const handleAddNewC = () => {
    navigate('/admin/collections/new');
  };

  const handleAddNewProject = () => {
    navigate('/admin/addproject')
  }

  if (isGettingProducts || isGettingCollections) {
    // Show a loading indicator while authentication status is being determined
    return <div className="text-center p-4">Loading Data...</div>;
  }

  return (
    <div>
      <h2 className="text-3xl font-semibold mb-6">Dashboard Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="stats shadow-lg bg-base-100 rounded-lg p-4"
          >
            <div className="stat">
              <div className="stat-title text-lg">{stat.label}</div>
              <div className="stat-value text-4xl">{stat.value}</div>
              {/* <div className="stat-desc">21% more than last month</div> */}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <h3 className="text-2xl font-semibold mb-4 text-secondary">
          Quick Actions
        </h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            className="flex-4 btn btn-xl btn-outline btn-primary rounded-full text-lg"
            onClick={handleAddNew}
          >
            Add Product
          </button>
          <button
            className="flex-4 btn btn-xl btn-outline btn-primary rounded-full text-lg"
            onClick={handleAddNewC}
          >
            Add Collection
          </button>
          <button
            className="flex-4 btn btn-xl btn-outline btn-primary rounded-full text-lg"
            onClick={handleAddNewProject}
          >
            Add Project
          </button>

          {/* <button className="flex-4 btn btn-xl btn-outline btn-primary rounded-full text-lg">
            View All Orders
          </button>
          <button className="flex-4 btn btn-xl btn-outline btn-primary rounded-full text-lg">
            Manage Reviews
          </button> */}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardContent;
