// src/components/Admin/CollectionManagement.jsx
import React, { useEffect, useState } from 'react';
import { useCollectionStore } from '../../store/useCollectionStore';
import { useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import AdminCollectionListCard from './CollectionList';

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
  
  // Local state for pagination
  const [currentPageLocal, setCurrentPageLocal] = useState(1);
  const [itemsPerPage] = useState(12); // You can make this configurable

  useEffect(() => {
    // Reset collections and get count on mount
    resetCollections();
    getCollectionsCount();
    getCollections(1, itemsPerPage, {}, false);
  }, [getCollections, getCollectionsCount, resetCollections, itemsPerPage]);

  const handleAddCollection = () => {
    navigate('/admin/collections/new');
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    
    setCurrentPageLocal(newPage);
    resetCollections();
    getCollections(newPage, itemsPerPage, {}, false);
  };

  const handlePrevPage = () => {
    if (currentPageLocal > 1) {
      handlePageChange(currentPageLocal - 1);
    }
  };

  const handleNextPage = () => {
    const totalPages = Math.ceil(collectionsCount / itemsPerPage);
    if (currentPageLocal < totalPages) {
      handlePageChange(currentPageLocal + 1);
    }
  };

  // Calculate pagination info
  const totalPages = collectionsCount ? Math.ceil(collectionsCount / itemsPerPage) : 0;
  const startItem = (currentPageLocal - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPageLocal * itemsPerPage, collectionsCount || 0);

  if (isGettingCollections && collections.length === 0) {
    // Show a loading indicator while initial data is being fetched
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin mr-2" size={24} />
        <span>Loading Collections...</span>
      </div>
    );
  }

  return (
    <div className="">
      <h2 className="text-3xl font-semibold mb-6 text-secondary font-[poppins]">
        Manage Collections
      </h2>
      
      {/* Header with Add button and results info */}
      <div className="flex justify-between items-center mb-6">
        <button
          className="btn btn-primary rounded-full text-white border-none shadow-none"
          onClick={handleAddCollection}
        >
          Add New Collection
        </button>
        
        {collectionsCount !== null && (
          <div className="text-sm text-gray-600">
            Showing {collections.length > 0 ? startItem : 0}-{endItem} of {collectionsCount} collections
          </div>
        )}
      </div>

      {/* Collections List */}
      <div className="bg-base-200 rounded-lg space-y-2 max-h-[60vh] overflow-y-auto mb-6">
        {collections.length === 0 && !isGettingCollections ? (
          <div className="text-center p-8">
            <p className="text-lg text-gray-500">No collections found.</p>
          </div>
        ) : (
          collections.map((collection) => (
            <AdminCollectionListCard
              key={collection._id}
              item={collection}
            />
          ))
        )}
        
        {/* Loading indicator for page changes */}
        {isGettingCollections && collections.length > 0 && (
          <div className="flex justify-center items-center p-4">
            <Loader2 className="animate-spin mr-2" size={20} />
            <span>Loading...</span>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
          {/* Page Info */}
          <div className="text-sm text-gray-600">
            Page {currentPageLocal} of {totalPages}
          </div>
          
          {/* Pagination Buttons */}
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={handlePrevPage}
              disabled={currentPageLocal === 1 || isGettingCollections}
              className="btn btn-sm btn-outline disabled:opacity-50"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            
            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {/* Show first page */}
              {currentPageLocal > 3 && (
                <>
                  <button
                    onClick={() => handlePageChange(1)}
                    className="btn btn-sm btn-outline"
                    disabled={isGettingCollections}
                  >
                    1
                  </button>
                  {currentPageLocal > 4 && <span className="px-2">...</span>}
                </>
              )}
              
              {/* Show pages around current page */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPageLocal <= 3) {
                  pageNum = i + 1;
                } else if (currentPageLocal >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPageLocal - 2 + i;
                }
                
                if (pageNum < 1 || pageNum > totalPages) return null;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    disabled={isGettingCollections}
                    className={`btn btn-sm ${
                      pageNum === currentPageLocal 
                        ? 'btn-primary text-white' 
                        : 'btn-outline'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              {/* Show last page */}
              {currentPageLocal < totalPages - 2 && (
                <>
                  {currentPageLocal < totalPages - 3 && <span className="px-2">...</span>}
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    className="btn btn-sm btn-outline"
                    disabled={isGettingCollections}
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>
            
            {/* Next Button */}
            <button
              onClick={handleNextPage}
              disabled={currentPageLocal === totalPages || isGettingCollections}
              className="btn btn-sm btn-outline disabled:opacity-50"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionManagement;